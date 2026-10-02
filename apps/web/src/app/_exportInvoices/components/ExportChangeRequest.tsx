'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

import type { ExportDocument } from '../schemas/exportDocumentSchema';
import type { ExportOp } from '../schemas/exportOpSchema';
import applyExportOps from '../utils/applyExportOps';
import deriveDocumentTotals from '../utils/deriveDocumentTotals';
import describeExportOp from '../utils/describeExportOp';
import validateExportDocument from '../utils/validateExportDocument';

export interface ExportChangeRequestProps {
  id: string;
  zohoCustomerId: string;
  consigneeName: string;
  document: ExportDocument;
  onApply: (ops: ExportOp[], summary: string, request: string) => Promise<unknown>;
}

/**
 * Ask for a change in plain words
 *
 * What customs asked for is typed as they said it. Claude proposes edits; the
 * proposal is shown with its effect on the totals and checks before anything
 * is saved, and can be kept as a standing rule for this consignee.
 */
const ExportChangeRequest = ({ id, zohoCustomerId, consigneeName, document, onApply }: ExportChangeRequestProps) => {
  const api = useTRPC();
  const [request, setRequest] = useState('');
  const requestMutation = useMutation({
    ...api.exportInvoices.admin.requestChange.mutationOptions(),
    onError: (error) => toast.error(error.message),
  });
  const ruleMutation = useMutation({
    ...api.exportInvoices.admin.saveRule.mutationOptions(),
    onSuccess: (r) => toast.success(`Saved as a rule for ${consigneeName}${r.dropped ? ` (${r.dropped} line-specific edit${r.dropped > 1 ? 's' : ''} left out)` : ''}`),
    onError: (error) => toast.error(error.message),
  });

  const proposal = requestMutation.data;
  let preview: { ok: true; next: ExportDocument } | { ok: false; error: string } | null = null;
  if (proposal && proposal.ops.length > 0) {
    try {
      preview = { ok: true, next: applyExportOps(document, proposal.ops) };
    } catch (error) {
      preview = { ok: false, error: error instanceof Error ? error.message : 'Does not apply' };
    }
  }
  const before = deriveDocumentTotals(document);
  const after = preview?.ok ? deriveDocumentTotals(preview.next) : null;
  const newErrors = preview?.ok
    ? validateExportDocument(preview.next).filter((c) => c.level === 'error').length -
      validateExportDocument(document).filter((c) => c.level === 'error').length
    : 0;

  const reset = () => {
    requestMutation.reset();
    setRequest('');
  };

  return (
    <div className="space-y-2">
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={3}
        placeholder="e.g. Customs want ABV on every line · declare 80 cases · add a note that goods are for re-export"
        className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 text-sm"
      />
      <Button
        size="sm"
        className="w-full justify-center"
        disabled={request.trim().length < 3 || requestMutation.isPending}
        onClick={() => requestMutation.mutate({ id, request: request.trim() })}
      >
        {requestMutation.isPending ? 'Working it out…' : 'Propose change'}
      </Button>

      {proposal && (
        <div className="space-y-2 rounded-lg border border-border-brand/40 bg-fill-brand/5 p-3 text-xs">
          <p>{proposal.explanation}</p>
          {proposal.needsZohoChange && (
            <p className="font-semibold text-text-warning">This needs the invoice reissued in Zoho, then a new draft.</p>
          )}
          {proposal.ops.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-text-muted">
              {proposal.ops.map((op, i) => (
                <li key={i}>{describeExportOp(op, document)}</li>
              ))}
            </ul>
          )}
          {(proposal.applyError || (preview && !preview.ok)) && (
            <p className="text-text-danger">{proposal.applyError ?? (preview && !preview.ok ? preview.error : '')}</p>
          )}
          {after && (
            <p className="text-text-muted">
              Total {document.header.currency} {before.total.toFixed(2)} → {after.total.toFixed(2)} · cases {before.declaredCases} → {after.declaredCases}
              {newErrors > 0 ? ` · ${newErrors} new error${newErrors > 1 ? 's' : ''}` : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {preview?.ok && (
              <Button
                size="xs"
                colorRole="brand"
                onClick={async () => {
                  await onApply(proposal.ops, proposal.explanation, request.trim());
                  reset();
                }}
              >
                Apply
              </Button>
            )}
            {preview?.ok && (
              <Button
                size="xs"
                variant="outline"
                disabled={ruleMutation.isPending}
                onClick={() => ruleMutation.mutate({ zohoCustomerId, consigneeName, text: request.trim(), ops: proposal.ops })}
              >
                {proposal.standingRuleCandidate ? 'Save as rule (suggested)' : 'Save as rule'}
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={reset}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportChangeRequest;
