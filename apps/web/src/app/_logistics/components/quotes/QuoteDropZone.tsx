'use client';

import { IconFileUpload, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import pendingQuoteDraft from '../../utils/pendingQuoteDraft';
import type { PendingQuoteDraft } from '../../utils/pendingQuoteDraft';
import { card, primaryButton, secondaryButton, sectionHeading } from '../exports/exportUi';

export interface QuoteDropZoneProps {
  requestId: string;
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
 * The quote is read and the quote form opens with it filled in, against this
 * request, for the person to check and save. Nothing is saved here.
 */
const QuoteDropZone = ({ requestId }: QuoteDropZoneProps) => {
  const api = useTRPC();
  const router = useRouter();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');

  const { mutateAsync: extractQuote, isPending: isReading } = useMutation({
    ...api.logistics.admin.quotes.extract.mutationOptions(),
    onError: (error) => toast.error(error.message || 'The quote could not be read'),
  });

  const openForm = useCallback(
    (draft: PendingQuoteDraft) => {
      pendingQuoteDraft(draft);
      router.push(`/platform/admin/logistics/quotes/new?requestId=${requestId}&draft=1`);
    },
    [requestId, router],
  );

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

      if (draft) openForm({ requestId, draft, file: { base64, fileName: file.name, mimeType } });
    },
    [extractQuote, openForm, requestId],
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
    if (draft) openForm({ requestId, draft, file: null });
  };

  return (
    <div className={`${card} space-y-3 p-4`}>
      <div className="flex items-center gap-2">
        <span className={sectionHeading}>Add a quote</span>
        <button type="button" className={`${secondaryButton} ml-auto`} onClick={() => setPasting((p) => !p)}>
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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
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
