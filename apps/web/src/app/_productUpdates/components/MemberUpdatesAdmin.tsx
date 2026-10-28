'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { toast } from 'sonner';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import useTRPC from '@/lib/trpc/browser';
import type { AppRouter } from '@/trpc-router';

import UpdateCard from './UpdateCard';
import UpdateEditDialog, { type UpdateDraft } from './UpdateEditDialog';
import UpdateTypeTag from './UpdateTypeTag';
import WhatsNewHero from './WhatsNewHero';
import WhatsNewTimeline from './WhatsNewTimeline';
import { AUTO_PUBLISH_FROM_DATE, AUTO_PUBLISH_HOLD_HOURS } from '../constants/autoPublish';

type Row = inferRouterOutputs<AppRouter>['productUpdates']['adminList']['updates'][number];
type Tab = 'draft' | 'published' | 'skipped' | 'preview';

const AUDIENCE_LABELS = { collector: 'Private Cellar', wine_partner: 'Trade partners' } as const;

const TILES: { key: Exclude<Tab, 'preview'>; label: string; tint: string }[] = [
  { key: 'draft', label: 'Drafts to review', tint: 'bg-amber-50 dark:bg-amber-500/10' },
  { key: 'published', label: 'Live to members', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { key: 'skipped', label: 'Not for members', tint: 'bg-fill-muted' },
];

/**
 * When an AI draft will publish itself, or null when it waits for a person:
 * written by hand, part of the launch backlog, or flagged by the copy check
 */
const publishesAt = (row: Row) => {
  if (row.status !== 'draft' || row.createdBy || row.flags.length > 0) return null;
  if (new Date(row.createdAt) < new Date(`${AUTO_PUBLISH_FROM_DATE}T00:00:00Z`)) return null;

  return new Date(new Date(row.updatedAt).getTime() + AUTO_PUBLISH_HOLD_HOURS * 3_600_000);
};

const smallButton = 'border-border-muted hover:bg-fill-muted rounded-lg border px-3 py-1.5 text-xs font-semibold';
const primaryButton = 'bg-text-primary text-surface-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40';

/**
 * Member Updates: where AI drafts of What's New are reviewed and published
 *
 * The AI reads every release and drafts what members would notice; nothing
 * reaches a member until someone presses Publish here, and wording that fails
 * the copy check cannot be published at all. The member page itself stays
 * hidden until it is switched on at the top of this screen.
 */
const MemberUpdatesAdmin = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('draft');
  const [editing, setEditing] = useState<UpdateDraft | null>(null);
  const [publishing, setPublishing] = useState<Row | null>(null);
  const [previewing, setPreviewing] = useState<Row | null>(null);
  const [confirmVisibility, setConfirmVisibility] = useState(false);
  const [confirmPublishReady, setConfirmPublishReady] = useState(false);

  const { data, isLoading } = useQuery(api.productUpdates.adminList.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: api.productUpdates.adminList.queryKey() });

  const onError = (error: { message: string }) => {
    toast.error(error.message);
  };

  const save = useMutation({
    ...api.productUpdates.adminSave.mutationOptions(),
    onSuccess: () => {
      toast.success('Saved');
      setEditing(null);
      void refresh();
    },
    onError,
  });

  const setStatus = useMutation({
    ...api.productUpdates.adminSetStatus.mutationOptions(),
    onSuccess: (_, input) => {
      toast.success(
        input.status === 'published'
          ? 'Published to members'
          : input.status === 'skipped'
            ? 'Set aside'
            : 'Moved to drafts',
      );
      setPublishing(null);
      void refresh();
    },
    onError,
  });

  const draftNow = useMutation({
    ...api.productUpdates.adminDraftNow.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        `${result.drafted} drafted, ${result.skipped} not for members${result.remaining > 0 ? `, ${result.remaining} still to read` : ''}`,
      );
      void refresh();
    },
    onError,
  });

  const publishReady = useMutation({
    ...api.productUpdates.adminPublishReady.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        `${result.published} published${result.held > 0 ? `, ${result.held} held for their wording` : ''}`,
      );
      setConfirmPublishReady(false);
      void refresh();
    },
    onError,
  });

  const setEnabled = useMutation({
    ...api.productUpdates.adminSetEnabled.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.enabled ? 'What’s New is now shown to members' : 'What’s New is hidden from members');
      setConfirmVisibility(false);
      void refresh();
    },
    onError,
  });

  const rows = data?.updates ?? [];
  const live = rows.filter((r) => r.status === 'published' && r.audiences.includes('collector'));
  const shown = tab === 'preview' ? [] : rows.filter((r) => r.status === tab);
  const readyCount = rows.filter((r) => r.status === 'draft' && r.flags.length === 0).length;

  const toDraft = (row: Row): UpdateDraft => ({
    id: row.id,
    type: row.type,
    audiences: row.audiences,
    title: row.title,
    body: row.body,
    linkPath: row.linkPath,
    sourceText: row.sourceText,
  });

  return (
    <div className="pb-10">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Member Updates</h1>
          <p className="text-text-muted mt-0.5 max-w-2xl text-sm">
            What&rsquo;s New for members. The AI drafts an update from each release, and it publishes itself a day
            later unless you edit or discard it. Drafts the copy check flags wait for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={smallButton}
            disabled={draftNow.isPending || !data?.pendingCount}
            onClick={() => draftNow.mutate()}
          >
            {draftNow.isPending
              ? 'Reading releases…'
              : data?.pendingCount
                ? `Read new releases (${data.pendingCount})`
                : 'All releases read'}
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={readyCount === 0}
            onClick={() => setConfirmPublishReady(true)}
          >
            Publish all ready ({readyCount})
          </button>
          <button
            type="button"
            className={primaryButton}
            onClick={() =>
              setEditing({ type: 'feature', audiences: ['collector'], title: '', body: '', linkPath: null })
            }
          >
            New update
          </button>
        </div>
      </header>

      <div
        className={`mb-5 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          data?.enabled
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-500/10'
            : 'border-border-muted bg-surface-muted'
        }`}
      >
        <p className="text-text-primary text-sm">
          {data?.enabled ? (
            <>
              <span className="font-semibold">Shown to Private Cellar members.</span> They see {live.length} published
              update{live.length === 1 ? '' : 's'} under What&rsquo;s New.
            </>
          ) : (
            <>
              <span className="font-semibold">Hidden from members.</span> Publish the launch updates, check them under
              Member view, then show the page.
            </>
          )}
        </p>
        <button
          type="button"
          className={data?.enabled ? smallButton : primaryButton}
          disabled={!data}
          onClick={() => setConfirmVisibility(true)}
        >
          {data?.enabled ? 'Hide from members' : 'Show to members'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            aria-pressed={tab === tile.key}
            onClick={() => setTab(tile.key)}
            className={`rounded-xl px-4 py-3 text-left ${tile.tint} ${tab === tile.key ? 'ring-text-primary ring-2' : ''}`}
          >
            <span className="text-text-primary block text-2xl font-semibold tabular-nums">
              {rows.filter((r) => r.status === tile.key).length}
            </span>
            <span className="text-text-muted text-xs font-semibold">{tile.label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={tab === 'preview'}
          onClick={() => setTab('preview')}
          className={`border-border-muted rounded-xl border px-4 py-3 text-left ${tab === 'preview' ? 'ring-text-primary ring-2' : ''}`}
        >
          <span className="text-text-primary block text-2xl font-semibold">Member view</span>
          <span className="text-text-muted text-xs font-semibold">The page as a cellar member sees it</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-fill-muted h-40 animate-pulse rounded-xl" />
      ) : tab === 'preview' ? (
        <div className="mx-auto max-w-3xl">
          <WhatsNewHero
            newCount={0}
            counts={{
              feature: live.filter((r) => r.type === 'feature').length,
              improvement: live.filter((r) => r.type === 'improvement').length,
              fix: live.filter((r) => r.type === 'fix').length,
            }}
          />
          <WhatsNewTimeline updates={live.map((r) => ({ ...r, date: r.createdAt }))} seenAt={null} preview />
        </div>
      ) : shown.length === 0 ? (
        <p className="border-border-muted text-text-muted rounded-xl border px-4 py-8 text-center text-sm">
          {tab === 'draft'
            ? 'No drafts waiting. New drafts arrive within the hour of each release.'
            : 'Nothing here.'}
        </p>
      ) : (
        <div className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-xl border">
          {shown.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start"
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <UpdateTypeTag type={row.type} />
                  <span className="text-text-muted text-xs font-semibold">
                    {row.audiences.length > 0
                      ? row.audiences.map((a) => AUDIENCE_LABELS[a]).join(' · ')
                      : 'No audience'}
                  </span>
                </div>
                <p className="text-text-primary text-sm font-semibold">{row.title}</p>
                {row.status === 'skipped' ? (
                  <p className="text-text-muted mt-1 text-xs italic">{row.skippedReason}</p>
                ) : (
                  row.body && <p className="text-text-muted mt-1 text-sm">{row.body}</p>
                )}
                {publishesAt(row) && (
                  <p className="text-text-muted mt-2 text-xs">
                    Publishes itself{' '}
                    {(publishesAt(row) as Date).toLocaleString('en-GB', {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {row.flags.length > 0 && (
                  <p className="mt-2 inline-flex rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
                    ⚠ Copy check: {row.flags.join('; ')}
                  </p>
                )}
              </div>
              <div className="bg-surface-muted min-w-0 rounded-lg px-3 py-2">
                <p className="text-text-muted mb-1 text-[11px] font-semibold tracking-wider uppercase">
                  {row.releaseVersion ? `From v${row.releaseVersion}` : 'Written by hand'}
                </p>
                <p className="text-text-secondary font-mono text-xs leading-relaxed break-words whitespace-pre-line">
                  {row.sourceText ?? '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {row.status === 'draft' && (
                  <>
                    <button type="button" className={smallButton} onClick={() => setPreviewing(row)}>
                      Preview
                    </button>
                    <button type="button" className={smallButton} onClick={() => setEditing(toDraft(row))}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() => setStatus.mutate({ id: row.id, status: 'skipped' })}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className={primaryButton}
                      disabled={row.flags.length > 0}
                      title={row.flags.length > 0 ? 'Fix the copy check first' : undefined}
                      onClick={() => setPublishing(row)}
                    >
                      Publish
                    </button>
                  </>
                )}
                {row.status === 'published' && (
                  <>
                    <button type="button" className={smallButton} onClick={() => setEditing(toDraft(row))}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() => setStatus.mutate({ id: row.id, status: 'draft' })}
                    >
                      Unpublish
                    </button>
                  </>
                )}
                {row.status === 'skipped' && (
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => {
                      setStatus.mutate({ id: row.id, status: 'draft' });
                      setEditing({ ...toDraft(row), audiences: row.audiences.length ? row.audiences : ['collector'] });
                    }}
                  >
                    Write for members
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <UpdateEditDialog
        draft={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(draft) =>
          save.mutate({
            id: draft.id,
            type: draft.type,
            audiences: draft.audiences,
            title: draft.title,
            body: draft.body,
            linkPath: draft.linkPath,
          })
        }
      />

      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview as a member</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {previewing && (
              <UpdateCard
                type={previewing.type}
                title={previewing.title}
                body={previewing.body}
                linkPath={previewing.linkPath}
                isNew
                preview
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!publishing} onOpenChange={(open) => !open && setPublishing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish to members?</DialogTitle>
            <DialogDescription>
              {publishing &&
                `“${publishing.title}” will be visible to all ${publishing.audiences
                  .map((a) => AUDIENCE_LABELS[a])
                  .join(' and ')} members, marked New.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={smallButton} onClick={() => setPublishing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={setStatus.isPending}
              onClick={() => publishing && setStatus.mutate({ id: publishing.id, status: 'published' })}
            >
              Publish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmPublishReady} onOpenChange={setConfirmPublishReady}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish {readyCount} drafts?</DialogTitle>
            <DialogDescription>
              Every draft that passes the copy check goes live to its members now. Drafts with a copy check warning
              stay here for you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={smallButton} onClick={() => setConfirmPublishReady(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={publishReady.isPending}
              onClick={() => publishReady.mutate()}
            >
              Publish {readyCount}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmVisibility} onOpenChange={setConfirmVisibility}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{data?.enabled ? 'Hide What’s New?' : 'Show What’s New to members?'}</DialogTitle>
            <DialogDescription>
              {data?.enabled
                ? 'The link leaves the Private Cellar menu. Published updates are kept.'
                : `Every Private Cellar member gets What’s New in their menu, with the ${live.length} published update${live.length === 1 ? '' : 's'}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={smallButton} onClick={() => setConfirmVisibility(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={setEnabled.isPending}
              onClick={() => setEnabled.mutate({ enabled: !data?.enabled })}
            >
              {data?.enabled ? 'Hide' : 'Show to members'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberUpdatesAdmin;
