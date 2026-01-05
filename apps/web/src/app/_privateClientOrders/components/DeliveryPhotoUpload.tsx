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

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
      reader.readAsDataURL(file);

      try {
        const base64 = await base64Promise;
        setPreviewUrl(base64);

        // Upload immediately
        uploadPhoto({
          file: base64,
          filename: file.name,
          fileType: file.type,
        });
      } catch (err) {
        console.error('Error reading file:', err);
        toast.error('Failed to read file');
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
