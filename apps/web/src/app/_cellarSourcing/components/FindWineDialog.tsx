'use client';

import { IconSearch, IconSparkles, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import useTRPC from '@/lib/trpc/browser';

const FORMATS = ['75cl', 'Magnum', 'Half bottle', 'Larger format', 'Any'];

const label = 'text-text-primary mb-1 block text-xs font-semibold';

/**
 * "Find me a wine": a member asks us to source something not on the list
 *
 * Picking the wine from the LWIN list removes any doubt about which wine is
 * meant; typing the name is always allowed, because a collector knows what
 * they want even when our list does not.
 */
const FindWineDialog = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [wineName, setWineName] = useState('');
  const [lwin, setLwin] = useState<string | null>(null);
  const [vintages, setVintages] = useState('');
  const [bottles, setBottles] = useState('6');
  const [format, setFormat] = useState('75cl');
  const [budget, setBudget] = useState('');
  const [holdAt, setHoldAt] = useState<'uae' | 'uk'>('uae');
  const [notes, setNotes] = useState('');

  const term = useDeferredValue(wineName.trim());

  const { data: suggestions } = useQuery({
    ...api.cellarSourcing.member.searchWines.queryOptions({ query: term }),
    enabled: isOpen && term.length >= 3 && !lwin,
    staleTime: 60_000,
  });

  const reset = () => {
    setWineName('');
    setLwin(null);
    setVintages('');
    setBottles('6');
    setFormat('75cl');
    setBudget('');
    setHoldAt('uae');
    setNotes('');
  };

  const { mutate: send, isPending } = useMutation(
    api.cellarSourcing.member.createRequest.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Thank you. We will look for it and come back to you (${result.requestNumber}).`,
        );
        void queryClient.invalidateQueries({
          queryKey: api.cellarSourcing.member.get.queryKey(),
        });
        reset();
        setIsOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const bottleCount = parseInt(bottles, 10);
  const budgetValue = budget ? parseFloat(budget) : undefined;
  const canSend =
    wineName.trim().length >= 2 && Number.isFinite(bottleCount) && bottleCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="border-border-muted text-text-primary hover:bg-fill-muted inline-flex h-9 flex-shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 text-xs font-semibold transition-colors sm:self-auto"
      >
        <Icon icon={IconSparkles} size="xs" /> Find me a wine
      </button>

      <Dialog open={isOpen} onOpenChange={(open) => !isPending && setIsOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Find me a wine</DialogTitle>
            <DialogDescription>
              Tell us what you are looking for. We will search our merchants and
              growers and come back to you with an offer.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full space-y-4 overflow-y-auto px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="relative">
              <span className={label}>Wine</span>
              {lwin ? (
                <div className="border-border-muted flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {wineName}
                  </span>
                  <button
                    type="button"
                    aria-label="Choose a different wine"
                    onClick={() => setLwin(null)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <Icon icon={IconX} size="xs" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Icon
                    icon={IconSearch}
                    size="sm"
                    className="text-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  />
                  <Input
                    value={wineName}
                    onChange={(event) => setWineName(event.target.value)}
                    placeholder="Producer and wine, e.g. Rousseau Chambertin"
                    className="pl-9"
                  />
                </div>
              )}
              {!lwin && (suggestions?.wines.length ?? 0) > 0 && (
                <ul className="border-border-muted bg-surface-primary divide-border-muted mt-1 max-h-48 divide-y overflow-y-auto rounded-lg border shadow-sm">
                  {suggestions?.wines.map((wine) => (
                    <li key={wine.lwin}>
                      <button
                        type="button"
                        onClick={() => {
                          setWineName(wine.displayName);
                          setLwin(wine.lwin);
                        }}
                        className="hover:bg-fill-muted/50 w-full px-3 py-2 text-left"
                      >
                        <span className="text-text-primary block text-sm">
                          {wine.displayName}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {[wine.region, wine.country].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>Vintage</span>
                <Input
                  value={vintages}
                  onChange={(event) => setVintages(event.target.value)}
                  placeholder="e.g. 2010 or 2016"
                />
              </label>
              <label className="block">
                <span className={label}>Bottles</span>
                <Input
                  type="number"
                  min={1}
                  value={bottles}
                  onChange={(event) => setBottles(event.target.value)}
                />
              </label>
              <label className="block">
                <span className={label}>Format</span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  className="border-border-muted bg-surface-primary text-text-primary h-10 w-full rounded-lg border px-3 text-sm"
                >
                  {FORMATS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Up to, per bottle (USD)</span>
                <Input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div>
              <span className={label}>Where should we hold it?</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'uae', title: 'In the UAE', detail: 'Your cellar in our bonded warehouse' },
                    { id: 'uk', title: 'In the UK', detail: 'London City Bond, Burton' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setHoldAt(option.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      holdAt === option.id
                        ? 'border-text-primary bg-fill-muted/40'
                        : 'border-border-muted hover:border-text-muted'
                    }`}
                  >
                    <span className="text-text-primary block text-sm font-semibold">
                      {option.title}
                    </span>
                    <span className="text-text-muted block text-xs">{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className={label}>Anything else we should know</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Provenance, condition, a deadline…"
                className="border-border-muted bg-surface-primary text-text-primary w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="border-border-muted text-text-primary h-11 rounded-lg border px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSend || isPending}
                onClick={() =>
                  send({
                    lwin: lwin ?? undefined,
                    wineName: wineName.trim(),
                    vintages: vintages || undefined,
                    bottles: bottleCount,
                    format,
                    budgetPerBottleUsd:
                      budgetValue && budgetValue > 0 ? budgetValue : undefined,
                    holdAt,
                    notes: notes || undefined,
                  })
                }
                className="bg-text-primary text-surface-primary h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FindWineDialog;
