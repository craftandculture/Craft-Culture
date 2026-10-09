'use client';

import { IconFile, IconFileTypePdf, IconPhoto, IconTable, IconTrash, IconUpload } from '@tabler/icons-react';
import { upload } from '@vercel/blob/client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import useTaskMutations from '../hooks/useTaskMutations';

export interface TaskFile {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  at: Date | string;
  name: string | null;
}

/** What the upload route accepts; anything else is refused before it is sent */
const ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
const MAX_BYTES = 10 * 1024 * 1024;

const size = (bytes: number | null) =>
  bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const when = (at: Date | string) =>
  new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });

const iconFor = (mime: string | null) =>
  mime?.startsWith('image/') ? IconPhoto : mime === 'application/pdf' ? IconFileTypePdf : mime?.includes('sheet') || mime?.includes('excel') || mime === 'text/csv' ? IconTable : IconFile;

/**
 * A job's files: a quote, a photo, an invoice, a supplier's sheet
 *
 * Drop files on the box or choose them. Each goes straight from the browser
 * to Blob (so large scans are fine, up to 10MB each) and is then recorded on
 * the job; adding or removing one is written to the job's history.
 */
const TaskFiles = ({ taskId, files }: { taskId: string; files: TaskFile[] }) => {
  const m = useTaskMutations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const send = async (list: FileList | File[]) => {
    const chosen = Array.from(list);
    const refused = chosen.filter((f) => !ACCEPT.includes(f.type) || f.size > MAX_BYTES);
    refused.forEach((f) =>
      toast.error(f.size > MAX_BYTES ? `${f.name} is over 10MB` : `${f.name}: PDF, image, Word, Excel, PowerPoint, CSV or text only`),
    );

    const ok = chosen.filter((f) => !refused.includes(f));
    if (!ok.length) return;

    setUploading((n) => n + ok.length);
    await Promise.all(
      ok.map(async (f) => {
        try {
          const blob = await upload(`team-tasks/${taskId}/${f.name}`, f, { access: 'public', handleUploadUrl: '/api/upload/blob' });
          await m.addAttachment.mutateAsync({ taskId, fileUrl: blob.url, fileName: f.name, mimeType: f.type || null, fileSize: f.size });
        } catch (error) {
          toast.error(`${f.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-muted">Files</p>

      {files.length > 0 && (
        <ul className="mb-2 divide-y divide-border-muted rounded-lg border border-border-muted">
          {files.map((f) => {
            const Icon = iconFor(f.mimeType);
            return (
              <li key={f.id} className="flex items-center gap-2.5 px-2.5 py-2">
                <Icon size={18} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <a href={f.fileUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-text-primary hover:underline">
                    {f.fileName}
                  </a>
                  <p className="text-[11px] text-text-muted">
                    {[f.name, when(f.at), size(f.fileSize)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {confirming === f.id ? (
                  <button
                    type="button"
                    onClick={() => m.removeAttachment.mutate({ attachmentId: f.id }, { onSettled: () => setConfirming(null) })}
                    disabled={m.removeAttachment.isPending}
                    className="h-7 shrink-0 rounded-lg bg-fill-danger/15 px-2 text-xs font-medium text-text-danger"
                  >
                    Remove?
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${f.fileName}`}
                    onClick={() => setConfirming(f.id)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-fill-secondary hover:text-text-danger"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void send(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void send(e.dataTransfer.files);
        }}
        disabled={uploading > 0}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors ${
          over ? 'border-text-primary bg-fill-secondary text-text-primary' : 'border-border-primary text-text-muted hover:border-text-primary hover:text-text-primary'
        }`}
      >
        <IconUpload size={16} />
        {uploading > 0 ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}…` : 'Attach files — drop here or click'}
      </button>
    </div>
  );
};

export default TaskFiles;
