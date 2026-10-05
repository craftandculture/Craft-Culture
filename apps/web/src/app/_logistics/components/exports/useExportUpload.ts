'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upload } from '@vercel/blob/client';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

export type ExportDocumentKind = 'invoice' | 'stamped' | 'awb' | 'bl' | 'other';

/**
 * Upload a file to an export job
 *
 * Straight from the browser to Blob, then recorded on the job, so a large
 * scan is never sent through the request body (which Vercel caps at 4.5MB).
 *
 * @param shipmentId - The job's shipment
 */
const useExportUpload = (shipmentId: string) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const addDocument = useMutation(api.logistics.admin.exports.addDocument.mutationOptions());

  const send = async (file: File, kind: ExportDocumentKind) => {
    setUploading(true);
    try {
      const blob = await upload(`logistics/exports/${shipmentId}/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/blob',
      });
      await addDocument.mutateAsync({
        shipmentId,
        blobUrl: blob.url,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        kind,
      });
      await queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getOne.queryKey({ shipmentId }) });
      void queryClient.invalidateQueries({ queryKey: api.logistics.admin.exports.getMany.queryKey() });
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return { send, uploading };
};

export default useExportUpload;
