'use client';

import { IconFileUpload, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import type { QuoteDraft } from '../../utils/pendingQuoteDraft';
import { primaryButton, secondaryButton } from '../exports/exportUi';

export interface QuoteDropZoneProps {
  /** Called with the quote as read, and the document it came from, to open the editor on */
  onRead: (draft: QuoteDraft | null, file: { base64: string; fileName: string; mimeType: string } | null) => void;
}

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Add a forwarder's quote by dropping its PDF or pasting its email
 *
 * The quote is read and handed back to open the quote editor on, filled in,
 * for the person to check and save. Nothing is saved here. Typing a quote in
 * by hand opens the editor empty.
 */
const QuoteDropZone = ({ onRead }: QuoteDropZoneProps) => {
  const api = useTRPC();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');

  const { mutateAsync: extractQuote, isPending: isReading } = useMutation({
    ...api.logistics.admin.quotes.extract.mutationOptions(),
    onError: (error) => toast.error(error.message || 'The quote could not be read'),
  });


  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

      if (mimeType !== 'application/pdf' && mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        toast.error('Use a PDF, JPG or PNG');
        return;
      }

      const base64 = await readBase64(file);
      const draft = await extractQuote({ file: { base64, mimeType, fileName: file.name } }).catch(() => null);

      if (draft) onRead(draft, { base64, fileName: file.name, mimeType });
    },
    [extractQuote, onRead],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: isReading,
  });

  const readText = async () => {
    const draft = await extractQuote({ text }).catch(() => null);
    if (draft) {
      onRead(draft, null);
      setText('');
      setPasting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={() => onRead(null, null)}>
          Type it in
        </button>
        <button type="button" className={secondaryButton} onClick={() => setPasting((p) => !p)}>
          {pasting ? 'Drop a file instead' : 'Paste an email instead'}
        </button>
      </div>

      {pasting ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste the forwarder's email with their prices"
            className="w-full rounded-lg border border-border-muted bg-surface-primary p-3 text-sm text-text-primary focus:border-text-primary focus:outline-none"
          />
          <button
            type="button"
            className={primaryButton}
            disabled={isReading || text.trim().length < 20}
            onClick={() => void readText()}
          >
            {isReading ? <IconLoader2 size={15} className="animate-spin" /> : null} Read the quote
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            isDragActive ? 'border-text-primary bg-surface-secondary/50' : 'border-border-muted hover:border-text-primary'
          }`}
        >
          <input {...getInputProps()} />
          {isReading ? (
            <>
              <IconLoader2 size={22} className="mb-2 animate-spin text-text-muted" />
              <p className="text-sm text-text-muted">Reading the quote…</p>
            </>
          ) : (
            <>
              <IconFileUpload size={22} className="mb-2 text-text-muted" />
              <p className="text-sm text-text-primary">Drop the forwarder&apos;s quote here, or click to choose it</p>
              <p className="mt-1 text-xs text-text-muted">PDF, JPG or PNG up to 10 MB. You check it before it is saved.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QuoteDropZone;
