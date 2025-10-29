'use client';

import { IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

/**
 * Company logo upload component
 *
 * Allows users to upload, preview, and remove their company logo
 */
const CompanyLogoUpload = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch current settings
  const { data: settings } = useQuery({
    queryKey: ['settings.get'],
    queryFn: () => trpcClient.settings.get.query(),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;

      return trpcClient.settings.uploadLogo.mutate({
        file: base64,
        filename: file.name,
        fileType: file.type as 'image/png' | 'image/jpeg' | 'image/jpg',
      });
    },
    onSuccess: () => {
      toast.success('Logo uploaded successfully');
      void queryClient.invalidateQueries({ queryKey: ['settings.get'] });
    },
    onError: (error) => {
      toast.error(`Failed to upload logo: ${error.message}`);
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: () => trpcClient.settings.removeLogo.mutate(),
    onSuccess: () => {
      toast.success('Logo removed successfully');
      void queryClient.invalidateQueries({ queryKey: ['settings.get'] });
    },
    onError: (error) => {
      toast.error(`Failed to remove logo: ${error.message}`);
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PNG or JPG image');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    if (window.confirm('Are you sure you want to remove your logo?')) {
      removeMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <Typography variant="bodySm" className="mb-1 font-medium">
          Company Logo
        </Typography>
        <Typography variant="bodyXs" colorRole="muted">
          Your logo will appear on all PDF quotes
        </Typography>
      </div>

      {/* Logo Preview */}
      <div className="flex items-center gap-4">
        <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-border-muted bg-fill-muted">
          {settings?.companyLogo ? (
            <Image
              src={settings.companyLogo}
              alt="Company logo"
              width={128}
              height={128}
              className="h-full w-full rounded-lg object-contain p-2"
            />
          ) : (
            <IconPhoto className="h-12 w-12 text-text-muted" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          {settings?.companyLogo ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                isDisabled={isUploading || removeMutation.isPending}
              >
                <ButtonContent iconLeft={IconUpload}>
                  {isUploading ? 'Uploading...' : 'Change Logo'}
                </ButtonContent>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                isDisabled={isUploading || removeMutation.isPending}
              >
                <ButtonContent iconLeft={IconTrash}>
                  {removeMutation.isPending ? 'Removing...' : 'Remove'}
                </ButtonContent>
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleUploadClick}
              isDisabled={isUploading}
            >
              <ButtonContent iconLeft={IconUpload}>
                {isUploading ? 'Uploading...' : 'Upload Logo'}
              </ButtonContent>
            </Button>
          )}
        </div>
      </div>

      {/* File Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Helper Text */}
      <Typography variant="bodyXs" colorRole="muted">
        PNG or JPG, max 2MB • Recommended: 400x200px (2:1 ratio)
      </Typography>
    </div>
  );
};

export default CompanyLogoUpload;
