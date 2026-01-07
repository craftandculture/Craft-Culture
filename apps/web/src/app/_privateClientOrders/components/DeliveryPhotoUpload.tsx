'use client';

import {
  IconCamera,
  IconCheck,
  IconCloudUpload,
  IconLoader2,
  IconPhoto,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_DIMENSION = 2048; // Max width/height for resizing

/**
 * Compress an image file to fit under the max file size
 */
const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under max size
      const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Estimate size from base64 (remove data URL prefix, calculate)
        const base64Length = dataUrl.split(',')[1]?.length ?? 0;
        const sizeInBytes = (base64Length * 3) / 4;

        if (sizeInBytes <= MAX_FILE_SIZE) {
          resolve(dataUrl);
          return;
        }
      }

      // If still too large, reduce dimensions further
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = width / 2;
      smallerCanvas.height = height / 2;
      const smallerCtx = smallerCanvas.getContext('2d');
      if (!smallerCtx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      smallerCtx.drawImage(canvas, 0, 0, width / 2, height / 2);
      resolve(smallerCanvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export interface DeliveryPhotoUploadProps {
  orderId: string;
  existingPhotoUrl?: string | null;
  orderStatus: string;
  onUploaded?: () => void;
}

/**
 * Proof of Delivery Upload component for distributors
 *
 * Allows distributors to upload proof of delivery photos.
 * Shows after delivery is complete or during out_for_delivery status.
 * Can be used independently of marking order as delivered.
 */
const DeliveryPhotoUpload = ({
  orderId,
  existingPhotoUrl,
  orderStatus,
  onUploaded,
}: DeliveryPhotoUploadProps) => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const { mutate: uploadPhoto, isPending: isUploading } = useMutation({
    mutationFn: async (data: { file: string; filename: string; fileType: string }) => {
      return trpcClient.privateClientOrders.distributorUploadDeliveryPhoto.mutate({
        orderId,
        file: data.file,
        filename: data.filename,
        fileType: data.fileType as 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: () => {
      toast.success('Delivery photo uploaded successfully');
      setPreviewUrl(null);
      void queryClient.invalidateQueries({ queryKey: ['privateClientOrders'] });
      onUploaded?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload delivery photo');
    },
  });

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select an image file (PNG, JPG)');
        return;
      }

      try {
        let base64: string;

        // Compress if file is larger than max size
        if (file.size > MAX_FILE_SIZE) {
          toast.info('Compressing image...');
          base64 = await compressImage(file);
        } else {
          // Read file directly if small enough
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
        }

        setPreviewUrl(base64);

        // Upload immediately (always use JPEG for compressed images)
        const isCompressed = file.size > MAX_FILE_SIZE;
        uploadPhoto({
          file: base64,
          filename: isCompressed
            ? file.name.replace(/\.[^.]+$/, '.jpg')
            : file.name,
          fileType: isCompressed ? 'image/jpeg' : file.type,
        });
      } catch (err) {
        console.error('Error processing file:', err);
        toast.error('Failed to process image');
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadPhoto],
  );

  // Show component for these statuses
  const showUpload =
    orderStatus === 'out_for_delivery' || orderStatus === 'delivered';

  if (!showUpload) {
    return null;
  }

  const hasPhoto = existingPhotoUrl || previewUrl;
  const displayUrl = previewUrl || existingPhotoUrl;

  return (
    <>
      {/* Full Image Modal */}
      {showFullImage && displayUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setShowFullImage(false)}
          >
            <IconX size={24} />
          </button>
          <Image
            src={displayUrl}
            alt="Proof of delivery"
            width={1200}
            height={800}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            unoptimized
          />
        </div>
      )}

      <Card
        className={`border-2 ${
          hasPhoto
            ? 'border-fill-success/50 bg-fill-success/5'
            : orderStatus === 'delivered'
              ? 'border-fill-muted bg-surface-secondary'
              : 'border-fill-brand/50 bg-fill-brand/5'
        }`}
      >
        <CardContent className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Icon */}
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                hasPhoto
                  ? 'bg-fill-success/20'
                  : orderStatus === 'delivered'
                    ? 'bg-fill-muted/20'
                    : 'bg-fill-brand/20'
              }`}
            >
              <Icon
                icon={hasPhoto ? IconCheck : IconCamera}
                size="lg"
                className={
                  hasPhoto
                    ? 'text-fill-success'
                    : orderStatus === 'delivered'
                      ? 'text-text-muted'
                      : 'text-fill-brand'
                }
              />
            </div>

            {/* Content */}
            <div className="flex-1">
              <Typography variant="headingSm" className="mb-1">
                {hasPhoto ? 'Proof of Delivery Uploaded' : 'Upload Proof of Delivery'}
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                {hasPhoto
                  ? 'Proof of delivery photo is on file. You can upload a new photo to replace it.'
                  : 'Upload a photo showing the package at the delivery location (e.g., on doorstep with ID visible).'}
              </Typography>

              {/* Photo Preview */}
              {displayUrl && (
                <div className="mt-4 flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => setShowFullImage(true)}
                    className="group relative overflow-hidden rounded-lg border border-border-muted"
                  >
                    <Image
                      src={displayUrl}
                      alt="Proof of delivery"
                      width={120}
                      height={90}
                      className="h-[90px] w-[120px] object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                      <IconPhoto className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <IconLoader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </button>
                  <div className="text-xs text-text-muted">
                    <p>Click to view full size</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 sm:flex-col">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant={hasPhoto ? 'outline' : 'default'}
                colorRole={hasPhoto ? undefined : 'brand'}
              >
                <ButtonContent
                  iconLeft={isUploading ? IconLoader2 : IconCloudUpload}
                  isLoading={isUploading}
                >
                  {hasPhoto ? 'Replace Photo' : 'Upload Photo'}
                </ButtonContent>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default DeliveryPhotoUpload;
