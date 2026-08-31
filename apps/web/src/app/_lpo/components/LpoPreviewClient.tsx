'use client';

import { IconFileUpload } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import LpoPreviewReport from './LpoPreviewReport';

type LpoPreview = inferRouterOutputs<AppRouter>['lpo']['admin']['preview'];

/**
 * Upload a client purchase order and read it back against live stock.
 *
 * The screen asks the questions in the order they matter: does the document add
 * up, does every line mean a wine we can identify, do we hold it, and what
 * would have to be created in Zoho. Nothing is written by any of it.
 */
const LpoPreviewClient = () => {
  const api = useTRPC();
  const [preview, setPreview] = useState<LpoPreview | null>(null);
  /**
   * Whose lines to take from a replenishment sheet.
   *
   * "The OpenCellar lines" is a real instruction: one sheet carries several
   * consignors and an order is placed with one of them.
   */
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const previewMutation = useMutation({
    ...api.lpo.admin.preview.mutationOptions(),
    onSuccess: (result) => {
      setPreview(result);
      toast.success(
        `${result.summary.matched} of ${result.reconciliation.lineCount} lines identified`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const onFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    previewMutation.mutate({
      file: base64,
      fileName: file.name,
      // Only meaningful for a replenishment sheet, which carries several
      // consignors in one file
      source: source.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-muted bg-fill-secondary/40 px-6 py-10 text-center hover:bg-fill-secondary">
        <IconFileUpload className="h-6 w-6 text-text-muted" />
        <span className="text-sm font-medium">
          {previewMutation.isPending
            ? 'Reading the order…'
            : 'Choose the LPO PDF, or a replenishment spreadsheet'}
        </span>
        <span className="text-[12px] text-text-muted">
          {fileName ?? 'Nothing is saved, and nothing is sent to Zoho'}
        </span>
        <input
          type="file"
          accept="application/pdf,.xlsx,.xls,.csv"
          className="hidden"
          disabled={previewMutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            // Cleared so choosing the same file again still fires a change.
            event.target.value = '';
          }}
        />
      </label>

      {/*
        A replenishment sheet lists several consignors; an order goes to one.
        Left blank it reads every row that asks for something.
      */}
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
        Spreadsheet only — take only rows from
        <input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="e.g. OpenCellar"
          className="rounded-md border border-border-muted bg-background-primary px-2 py-1 text-[13px] text-text-primary"
        />
        <span>(blank takes every row that asks for stock)</span>
      </label>

      {preview && <LpoPreviewReport preview={preview} />}
    </div>
  );
};

export default LpoPreviewClient;
