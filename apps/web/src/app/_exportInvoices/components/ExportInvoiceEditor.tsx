'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import useTRPC from '@/lib/trpc/browser';

import ExportChangeRequest from './ExportChangeRequest';
import ExportChecksPanel from './ExportChecksPanel';
import ExportDocumentPreview from './ExportDocumentPreview';
import ExportHeaderPanel from './ExportHeaderPanel';
import ExportPanel from './ExportPanel';
import ExportSummaryStrip from './ExportSummaryStrip';
import type { ExportOp } from '../schemas/exportOpSchema';

export interface ExportInvoiceEditorProps {
  id: string;
}

type SideTab = 'checks' | 'ask' | 'header' | 'history';

/**
 * The export invoice editor
 *
 * The document on the left, edited in place; checks, change requests, the
 * header and history in separate cards on the right. Below extra-wide screens
 * the cards become tabs above the document, so a phone or laptop shows one at
 * a time. Every change goes through one mutation as ops, versioned, with the
 * checks re-run against the saved result.
 */
const ExportInvoiceEditor = ({ id }: ExportInvoiceEditorProps) => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [tab, setTab] = useState<SideTab>('checks');
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

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

  const cancelMutation = useMutation({
    ...api.exportInvoices.admin.cancelIssued.mutationOptions(),
    onSuccess: () => {
      toast.success('Export invoice cancelled');
      setCancelReason(null);
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const reopenMutation = useMutation({
    ...api.exportInvoices.admin.reopen.mutationOptions(),
    onSuccess: () => {
      toast.success('Reopened for editing — re-issue when done');
      setReopenReason(null);
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-fill-muted/50" />
        <div className="h-14 animate-pulse rounded-lg bg-fill-muted/50" />
        <div className="h-96 animate-pulse rounded-lg bg-fill-muted/50" />
      </div>
    );
  }
  if (!query.data) return <p className="text-sm text-text-danger">{query.error?.message ?? 'Not found'}</p>;

  const data = query.data;
  const editable = data.status === 'draft';
  const revising = editable && Boolean(data.number);
  const errors = data.checks.filter((c) => c.level === 'error');
  const warnings = data.checks.filter((c) => c.level === 'warning');
  const pdfHref = data.pdfUrl ?? `/api/admin/export-invoices/${id}/pdf`;
  const canIssue = errors.length === 0 && (warnings.length === 0 || acknowledged) && !issueMutation.isPending;

  const apply = (ops: ExportOp[], changeSummary: string, request?: string) =>
    applyMutation.mutateAsync({ id, expectedVersion: data.version, ops, changeSummary, request });
  const issue = () =>
    issueMutation.mutate({ id, expectedVersion: data.version, acknowledgedWarnings: warnings.map((w) => w.code) });

  const checksPanel = (
    <ExportPanel
      title="Checks"
      aside={
        <span className={`text-xs font-medium ${errors.length ? 'text-text-danger' : warnings.length ? 'text-text-warning' : 'text-text-success'}`}>
          {errors.length ? `${errors.length} to fix` : warnings.length ? `${warnings.length} to review` : 'Ready'}
        </span>
      }
    >
      <ExportChecksPanel checks={data.checks} onSelectLines={setHighlighted} />
      {editable && (
        <div className="mt-4 space-y-3 border-t border-border-muted pt-4">
          {warnings.length > 0 && errors.length === 0 && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 size-4" />
              I have read the warnings and the document is right to send.
            </label>
          )}
          <Button colorRole="brand" className="w-full justify-center" disabled={!canIssue} onClick={issue}>
            {issueMutation.isPending ? 'Issuing…' : errors.length ? 'Fix the errors to issue' : revising ? `Re-issue ${data.number}` : 'Issue and number'}
          </Button>
        </div>
      )}
    </ExportPanel>
  );
  const askPanel = editable ? (
    <ExportPanel title="Ask for a change">
      <ExportChangeRequest
        id={id}
        zohoCustomerId={data.zohoCustomerId}
        consigneeName={data.document.header.consignee.name}
        document={data.document}
        onApply={(ops, summary, request) => apply(ops, summary, request)}
      />
    </ExportPanel>
  ) : null;
  const headerPanel = (
    <ExportPanel title="Header & text">
      <ExportHeaderPanel document={data.document} editable={editable} onApply={(ops, summary) => void apply(ops, summary)} />
    </ExportPanel>
  );
  const historyPanel = (
    <ExportPanel title="History" aside={<span className="text-xs text-text-muted">v{data.version}</span>}>
      <ol className="space-y-3">
        {(showAllHistory ? data.versions : data.versions.slice(0, 3)).map((v) => (
          <li key={v.version} className="border-l-2 border-border-muted pl-3 text-xs">
            <p>
              <span className="font-semibold">v{v.version}</span> · {v.changeSummary ?? 'Edited'}
            </p>
            {v.request && <p className="mt-1 rounded-md bg-fill-muted/40 px-2 py-1 italic text-text-muted">“{v.request}”</p>}
            <p className="mt-1 text-text-muted">
              {v.createdByName ?? 'Someone'} · {new Date(v.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              {v.pdfUrl && (
                <>
                  {' · '}
                  <a className="underline" href={v.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
      {data.versions.length > 3 && (
        <button type="button" onClick={() => setShowAllHistory((v) => !v)} className="mt-3 text-xs font-medium text-text-brand hover:underline">
          {showAllHistory ? 'Show fewer' : `Show all ${data.versions.length} versions`}
        </button>
      )}
    </ExportPanel>
  );
  const pdfVersions = data.versions.filter((v) => v.pdfUrl);
  const documentPanel = (
    <ExportPanel title="Document">
      <a
        href={pdfHref}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-lg border border-border-muted px-3 py-2.5 text-sm hover:bg-fill-muted/30"
      >
        <span>
          <span className="font-semibold">{data.number}</span>
          <span className="block text-xs text-text-muted">Latest PDF</span>
        </span>
        <span className="text-xs font-medium text-text-brand">Open ↗</span>
      </a>
      {pdfVersions.length > 1 && (
        <p className="mt-2 text-xs text-text-muted">{pdfVersions.length} PDF versions — earlier ones are in History.</p>
      )}
    </ExportPanel>
  );

  const tabs: { key: SideTab; label: string; badge?: number }[] = [
    { key: 'checks', label: editable ? 'Checks' : 'Document', badge: editable ? errors.length + warnings.length || undefined : undefined },
    ...(editable ? [{ key: 'ask' as const, label: 'Ask' }] : []),
    { key: 'header', label: 'Header' },
    { key: 'history', label: 'History' },
  ];
  const tabPanel = { checks: editable ? checksPanel : documentPanel, ask: askPanel, header: headerPanel, history: historyPanel }[tab];

  return (
    <div className="space-y-4">
      {/* Title, status and actions */}
      <div className="rounded-xl border border-border-muted bg-fill-primary px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/platform/admin/logistics/export-invoices" className="text-xs text-text-muted hover:underline">
              ← Export invoices
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold sm:text-xl">{data.number ?? 'Draft export invoice'}</h1>
              <Badge colorRole={editable ? 'warning' : data.status === 'cancelled' ? 'danger' : 'success'} size="sm">
                {revising ? 'Revising' : editable ? 'Draft' : data.status === 'cancelled' ? 'Cancelled' : 'Issued'}
              </Badge>
              <span className="truncate text-sm text-text-muted">{data.document.header.consignee.name}</span>
            </div>
            {data.status === 'issued' && (
              <p className="mt-0.5 text-xs text-text-muted">Frozen. Edit reopens it under the same number; earlier PDFs stay in History.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && !revising &&
              (confirmDiscard ? (
                <span className="flex items-center gap-1.5 text-xs">
                  Discard this draft?
                  <Button size="xs" colorRole="danger" onClick={() => deleteMutation.mutate({ id })}>Discard</Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirmDiscard(false)}>Keep</Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)}>Discard</Button>
              ))}
            {data.status === 'issued' &&
              (reopenReason === null ? (
                <Button variant="outline" size="sm" onClick={() => setReopenReason('')}>Edit</Button>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <input
                    autoFocus
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="What needs changing, e.g. customs want ABV"
                    className="w-60 rounded-md border border-border-primary bg-fill-primary px-2 py-1"
                  />
                  <Button size="xs" colorRole="brand" disabled={reopenReason.trim().length < 3 || reopenMutation.isPending} onClick={() => reopenMutation.mutate({ id, reason: reopenReason.trim() })}>
                    Reopen {data.number}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setReopenReason(null)}>Back</Button>
                </span>
              ))}
            {(data.status === 'issued' || revising) &&
              (cancelReason === null ? (
                <Button variant="ghost" size="sm" className="text-text-danger" onClick={() => setCancelReason('')}>Cancel invoice</Button>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <input
                    autoFocus
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason, e.g. issued in error"
                    className="w-52 rounded-md border border-border-primary bg-fill-primary px-2 py-1"
                  />
                  <Button size="xs" colorRole="danger" disabled={cancelReason.trim().length < 3 || cancelMutation.isPending} onClick={() => cancelMutation.mutate({ id, reason: cancelReason.trim() })}>
                    Cancel {data.number}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setCancelReason(null)}>Keep</Button>
                </span>
              ))}
            <Button variant="outline" size="sm" asChild>
              <a href={pdfHref} target="_blank" rel="noreferrer">{editable ? 'Preview PDF' : 'Download PDF'}</a>
            </Button>
            {editable && (
              <Button
                size="sm"
                colorRole="brand"
                disabled={!canIssue}
                onClick={issue}
                title={errors.length ? 'Fix the errors in Checks first' : warnings.length && !acknowledged ? 'Tick the warnings as read in Checks' : undefined}
              >
                {revising ? 'Re-issue' : 'Issue'}
              </Button>
            )}
          </div>
        </div>
      </div>


      {revising && (
        <div className="rounded-xl border border-border-warning/30 bg-fill-warning/10 px-4 py-3 text-sm text-text-warning">
          Revising {data.number}. Make your changes, then Re-issue — it keeps the same number and saves a new PDF version.
        </div>
      )}
      {data.status === 'cancelled' && (
        <div className="rounded-xl border border-border-danger/30 bg-fill-danger/10 px-4 py-3 text-sm text-text-danger">
          {data.number} was cancelled{data.versions[0]?.request ? `: ${data.versions[0].request}` : ''}. The number stays used; its invoices are free to go on a new export invoice.
        </div>
      )}
      {data.stale.length > 0 && (
        <div className="rounded-xl border border-border-danger/30 bg-fill-danger/10 px-4 py-3 text-sm text-text-danger">
          <p className="font-semibold">Revised in Zoho since this draft was built</p>
          <p>{data.stale.map((s) => `${s.invoiceNumber} (${s.reason})`).join('; ')}. Build a new draft from the current invoices before issuing.</p>
        </div>
      )}

      <ExportSummaryStrip document={data.document} />

      {/* Below extra-wide screens: the side cards as tabs */}
      <div className="xl:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-border-muted bg-fill-muted/30 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                tab === t.key ? 'bg-fill-primary font-medium shadow-xs' : 'text-text-muted'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className={`rounded-full px-1.5 text-[10px] font-semibold ${errors.length ? 'bg-fill-danger/15 text-text-danger' : 'bg-fill-warning/15 text-text-warning'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {tabPanel}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ExportDocumentPreview
          document={data.document}
          editable={editable && !applyMutation.isPending}
          highlighted={highlighted}
          onApply={(ops, summary) => void apply(ops, summary)}
        />

        <aside className="hidden xl:block">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto pb-4">
            {editable ? checksPanel : documentPanel}
            {askPanel}
            {headerPanel}
            {historyPanel}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ExportInvoiceEditor;
