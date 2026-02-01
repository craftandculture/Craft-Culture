'use client';

import { IconCamera, IconPhoto, IconTrash, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface PhotoCaptureProps {
  /** Array of existing photo URLs */
  photos: string[];
  /** Called when photos change (add or remove) */
  onPhotosChange: (photos: string[]) => void;
  /** Called to upload a new photo, should return the URL */
  onUpload: (file: string, filename: string, fileType: string) => Promise<string>;
  /** Maximum number of photos allowed */
  maxPhotos?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * PhotoCapture - Component for capturing photos during receiving
 *
 * Uses the device camera on mobile, falls back to file picker on desktop.
 * Displays thumbnails of captured photos with delete option.
 *
 * @example
 *   <PhotoCapture
 *     photos={item.photos ?? []}
 *     onPhotosChange={(photos) => updateItem({ ...item, photos })}
 *     onUpload={async (file, filename, fileType) => {
 *       const result = await uploadPhoto({ file, filename, fileType });
 *       return result.url;
 *     }}
 *   />
 */
const PhotoCapture = ({
  photos,
  onPhotosChange,
  onUpload,
  maxPhotos = 5,
  disabled = false,
}: PhotoCaptureProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = () => {
    if (disabled || isUploading || photos.length >= maxPhotos) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      setError('Image must be less than 3MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const url = await onUpload(base64, file.name, file.type);
          onPhotosChange([...photos, url]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to upload photo');
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Failed to process photo');
      setIsUploading(false);
    }

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDelete = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-2">
      {/* Hidden file input with camera capture */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, index) => (
            <div
              key={url}
              className="group relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-border-secondary"
              onClick={() => setExpandedPhoto(url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(index);
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                disabled={disabled}
              >
                <Icon icon={IconTrash} size="xs" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture button */}
      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled || isUploading || photos.length >= maxPhotos}
        className="flex items-center gap-2 rounded-lg border border-border-secondary bg-fill-secondary px-3 py-2 transition-colors hover:bg-fill-tertiary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon
          icon={isUploading ? IconPhoto : IconCamera}
          size="md"
          className={isUploading ? 'animate-pulse' : ''}
        />
        <Typography variant="bodyXs">
          {isUploading
            ? 'Uploading...'
            : photos.length >= maxPhotos
              ? `Max ${maxPhotos} photos`
              : photos.length > 0
                ? 'Add Photo'
                : 'Take Photo'}
        </Typography>
      </button>

      {/* Error message */}
      {error && (
        <Typography variant="bodyXs" className="text-red-500">
          {error}
        </Typography>
      )}

      {/* Expanded photo modal */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedPhoto(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            onClick={() => setExpandedPhoto(null)}
          >
            <Icon icon={IconX} size="lg" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedPhoto}
            alt="Expanded view"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default PhotoCapture;
