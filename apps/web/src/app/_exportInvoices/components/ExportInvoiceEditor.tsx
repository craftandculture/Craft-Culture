'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ExportChangeRequest from './ExportChangeRequest';
import ExportChecksPanel from './ExportChecksPanel';
import ExportDocumentPreview from './ExportDocumentPreview';
import ExportHeaderPanel from './ExportHeaderPanel';
import type { ExportOp } from '../schemas/exportOpSchema';

export interface ExportInvoiceEditorProps {
  id: string;
}

/**
 * The export invoice editor
 *
 * The document on the left, edited in place; checks, change requests, the
 * header and history on the right. Every change goes through one mutation as
 * ops, so it is versioned and the checks re-run against the saved result.
 */
const ExportInvoiceEditor = ({ id }: ExportInvoiceEditorProps) => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const query = useQuery(api.exportInvoices.admin.getOne.queryOptions({ id }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: api.exportInvoices.admin.getOne.queryKey({ id }) });

  const applyMutation = useMutation({
    ...api.exportInvoices.admin.applyOps.mutationOptions(),
    onSuccess: () => {
      setAcknowledged(false);
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const issueMutation = useMutation({
    ...api.exportInvoices.admin.issue.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Issued ${result.number}`);
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    ...api.exportInvoices.admin.deleteDraft.mutationOptions(),
    onSuccess: () => router.push('/platform/admin/logistics/export-invoices'),
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!query.data) return <p className="text-sm text-text-danger">{query.error?.message ?? 'Not found'}</p>;

  const data = query.data;
  const editable = data.status === 'draft';
  const errors = data.checks.filter((c) => c.level === 'error');
  const warnings = data.checks.filter((c) => c.level === 'warning');

  const apply = (ops: ExportOp[], changeSummary: string, request?: string) =>
    applyMutation.mutateAsync({ id, expectedVersion: data.version, ops, changeSummary, request });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Typography variant="headingMd" asChild>
            <h1>{data.number ?? 'Draft export invoice'}</h1>
          </Typography>
          <Badge colorRole={editable ? 'warning' : 'success'}>{editable ? 'Draft' : 'Issued'}</Badge>
          <span className="text-sm text-text-muted">{data.document.header.consignee.name}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={data.pdfUrl ?? `/api/admin/export-invoices/${id}/pdf`} target="_blank" rel="noreferrer">
              {editable ? 'Preview PDF' : 'Download PDF'}
            </a>
          </Button>
          {editable && (
            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id })}>
              Discard draft
            </Button>
          )}
        </div>
      </div>

      {data.stale.length > 0 && (
        <div className="rounded-lg border border-border-danger/30 bg-fill-danger/10 p-3 text-sm text-text-danger">
          Revised in Zoho: {data.stale.map((s) => `${s.invoiceNumber} (${s.reason})`).join('; ')}. Build a new
          draft from the current invoices before issuing.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ExportDocumentPreview
          document={data.document}
          editable={editable && !applyMutation.isPending}
          highlighted={highlighted}
          onApply={(ops, summary) => void apply(ops, summary)}
        />

        <aside className="space-y-6">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-text-muted">Checks</p>
            <ExportChecksPanel checks={data.checks} onSelectLines={setHighlighted} />
            {editable && (
              <div className="space-y-2 pt-2">
                {warnings.length > 0 && errors.length === 0 && (
                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5" />
                    I have read the warnings and the document is right to send.
                  </label>
                )}
                <Button
                  colorRole="brand"
                  className="w-full justify-center"
                  disabled={errors.length > 0 || (warnings.length > 0 && !acknowledged) || issueMutation.isPending}
                  onClick={() =>
                    issueMutation.mutate({ id, expectedVersion: data.version, acknowledgedWarnings: warnings.map((w) => w.code) })
                  }
                >
                  {issueMutation.isPending ? 'Issuing…' : 'Issue and number'}
                </Button>
              </div>
            )}
          </section>

          {editable && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase text-text-muted">Ask for a change</p>
              <ExportChangeRequest
                id={id}
                zohoCustomerId={data.zohoCustomerId}
                consigneeName={data.document.header.consignee.name}
                document={data.document}
                onApply={(ops, summary, request) => apply(ops, summary, request)}
              />
            </section>
          )}

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-text-muted">Header & text</p>
            <ExportHeaderPanel document={data.document} editable={editable} onApply={(ops, summary) => void apply(ops, summary)} />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-text-muted">History</p>
            <ul className="space-y-1.5 text-xs">
              {data.versions.map((v) => (
                <li key={v.version} className="border-b border-border-muted/60 pb-1.5">
                  <span className="font-semibold">v{v.version}</span> · {v.changeSummary ?? 'Edited'}
                  {v.request && <span className="block text-text-muted">“{v.request}”</span>}
                  <span className="block text-text-muted">
                    {v.createdByName ?? 'Someone'} · {new Date(v.createdAt).toLocaleString('en-GB')}
                    {v.pdfUrl && (
                      <>
                        {' · '}
                        <a className="underline" href={v.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ExportInvoiceEditor;
