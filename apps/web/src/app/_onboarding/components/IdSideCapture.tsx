'use client';

import { IconCamera, IconCheck, IconLoader2, IconUpload } from '@tabler/icons-react';
import { useRef } from 'react';

export interface IdSideCaptureProps {
  label: string;
  isUploaded: boolean;
  isUploading: boolean;
  /** A preview of what was just chosen, before or after upload */
  previewUrl?: string | null;
  onFile: (file: File) => void;
}

/**
 * One side of the Emirates ID: take a photo or choose a file
 *
 * Two buttons rather than one, because `capture` forces the camera on a phone
 * and someone with a scan already on their phone should not have to retake it.
 */
const IdSideCapture = ({ label, isUploaded, isUploading, previewUrl, onFile }: IdSideCaptureProps) => {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  };

  return (
    <div
      className={`relative flex aspect-[1.586] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
        isUploaded ? 'border-border-brand bg-fill-brand/5' : 'border-border-primary bg-fill-primary'
      }`}
    >
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <span className="text-text-primary relative text-sm font-semibold">{label}</span>
      {isUploading ? (
        <span className="text-text-muted relative flex items-center gap-1.5 text-xs">
          <IconLoader2 size={16} className="animate-spin" /> Uploading securely…
        </span>
      ) : isUploaded ? (
        <span className="text-text-brand relative flex items-center gap-1 text-xs font-semibold">
          <IconCheck size={16} stroke={3} /> Added
        </span>
      ) : null}
      <div className="relative flex gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          disabled={isUploading}
          className="bg-fill-brand text-text-brand-on-fill flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <IconCamera size={16} /> {isUploaded ? 'Retake' : 'Take photo'}
        </button>
        <button
          type="button"
          onClick={() => library.current?.click()}
          disabled={isUploading}
          className="border-border-primary bg-fill-primary text-text-primary flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <IconUpload size={16} /> Upload
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={library} type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} />
    </div>
  );
};

export default IdSideCapture;
