'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconClipboardCheck,
  IconLoader2,
  IconMapPin,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

/**
 * Cycle Count Detail page
 *
 * Handles all 4 statuses:
 * - pending: shows expected stock + "Begin Counting" button
 * - in_progress: counting mode with quantity inputs per item
 * - completed: review mode showing discrepancies + reconcile controls
 * - reconciled: read-only summary
 */
const CycleCountDetailPage = () => {
  const params = useParams();
  const countId = params.countId as string;
  const api = useTRPC();
  const trpcClient = useTRPCClient();

  const [countedValues, setCountedValues] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.cycleCounts.getOne.queryOptions({ countId }),
  });

  const startMutation = useMutation({
    ...api.wms.admin.cycleCounts.start.mutationOptions(),
    onSuccess: () => {
      toast.success('Count started');
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const completeMutation = useMutation({
    ...api.wms.admin.cycleCounts.complete.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        `Count completed: ${result.discrepancyCount} discrepanc${result.discrepancyCount === 1 ? 'y' : 'ies'} found`,
      );
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const reconcileMutation = useMutation({
    ...api.wms.admin.cycleCounts.reconcile.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Reconciled: ${result.adjustedCount} adjustment(s) applied`);
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSaveItem = useCallback(
    async (itemId: string) => {
      const value = countedValues[itemId];
      if (value === undefined || value === '') return;

      const quantity = parseInt(value, 10);
      if (isNaN(quantity) || quantity < 0) {
        toast.error('Please enter a valid quantity');
        return;
      }

      setSavingItemId(itemId);
      try {
        await trpcClient.wms.admin.cycleCounts.recordItem.mutate({
          cycleCountId: countId,
          itemId,
          countedQuantity: quantity,
        });
        toast.success('Saved');
        void refetch();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        toast.error(message);
      } finally {
        setSavingItemId(null);
      }
    },
    [countedValues, countId, trpcClient, refetch],
  );

  const { mutate: completeCount } = completeMutation;
  const handleCompleteCount = useCallback(() => {
    completeCount({ countId });
  }, [countId, completeCount]);

  const { mutate: reconcileCount } = reconcileMutation;
  const handleReconcile = useCallback(() => {
    if (!data) return;

    const adjustments = data.items
      .filter((i) => i.discrepancy !== null && i.discrepancy !== 0)
      .map((i) => ({
        itemId: i.id,
        approved: approvals[i.id] ?? false,
      }));

    reconcileCount({ countId, adjustments });
  }, [countId, data, approvals, reconcileCount]);

  const toggleApproval = useCallback((itemId: string) => {
    setApprovals((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const toggleAllApprovals = useCallback(() => {
    if (!data) return;
    const discrepancyItems = data.items.filter((i) => i.discrepancy !== null && i.discrepancy !== 0);
    const allApproved = discrepancyItems.every((i) => approvals[i.id]);
    const newApprovals: Record<string, boolean> = {};
    discrepancyItems.forEach((i) => {
      newApprovals[i.id] = !allApproved;
    });
    setApprovals(newApprovals);
  }, [data, approvals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Icon icon={IconLoader2} size="lg" className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Typography variant="bodySm" colorRole="muted">Cycle count not found</Typography>
            <Link href="/platform/admin/wms/cycle-count">
              <Button size="sm" variant="ghost">
                <ButtonContent iconLeft={IconArrowLeft}>Back to Counts</ButtonContent>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = data.status ?? 'pending';
  const countedCount = data.items.filter((i) => i.countedQuantity !== null).length;
  const totalItems = data.items.length;
  const discrepancyItems = data.items.filter((i) => i.discrepancy !== null && i.discrepancy !== 0);
  const approvedCount = discrepancyItems.filter((i) => approvals[i.id]).length;

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      reconciled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Needs Review',
      reconciled: 'Reconciled',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[s] ?? ''}`}>
        {labels[s] ?? s}
      </span>
    );
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/platform/admin/wms/cycle-count">
            <Button variant="ghost" size="sm">
              <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Typography variant="h4" className="font-mono">{data.countNumber}</Typography>
              {getStatusBadge(status)}
            </div>
            <div className="flex items-center gap-2 text-text-muted">
              <Icon icon={IconMapPin} size="xs" />
              <Typography variant="bodySm" colorRole="muted">
                {data.locationCode ?? 'Unknown'}
              </Typography>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-fill-secondary p-3 text-center">
            <Typography variant="h4">{data.expectedItems ?? 0}</Typography>
            <Typography variant="bodySm" colorRole="muted">Expected</Typography>
          </div>
          <div className="rounded-lg bg-fill-secondary p-3 text-center">
            <Typography variant="h4">{data.countedItems ?? 0}</Typography>
            <Typography variant="bodySm" colorRole="muted">Counted</Typography>
          </div>
          <div className={`rounded-lg p-3 text-center ${(data.discrepancyCount ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-fill-secondary'}`}>
            <Typography variant="h4" className={(data.discrepancyCount ?? 0) > 0 ? 'text-red-600' : ''}>
              {data.discrepancyCount ?? 0}
            </Typography>
            <Typography variant="bodySm" colorRole="muted">Discrepancies</Typography>
          </div>
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <Typography variant="bodySm" className="text-yellow-800 dark:text-yellow-300">
              {data.notes}
            </Typography>
          </div>
        )}

        {/* PENDING: Show expected stock + start button */}
        {status === 'pending' && (
          <>
            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" className="mb-3 font-medium">
                  Expected Stock ({totalItems} product{totalItems !== 1 ? 's' : ''})
                </Typography>
                {totalItems === 0 ? (
                  <Typography variant="bodySm" colorRole="muted">
                    No stock expected at this location
                  </Typography>
                ) : (
                  <div className="space-y-2">
                    {data.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-fill-secondary p-3">
                        <div>
                          <Typography variant="bodySm" className="font-medium">{item.productName}</Typography>
                          <Typography variant="bodySm" colorRole="muted" className="font-mono text-xs">
                            {item.lwin18}
                          </Typography>
                        </div>
                        <Typography variant="bodySm" className="font-semibold">
                          {item.expectedQuantity} cases
                        </Typography>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Button
              onClick={() => startMutation.mutate({ countId })}
              disabled={startMutation.isPending}
              className="w-full"
            >
              <ButtonContent
                iconLeft={startMutation.isPending ? IconLoader2 : IconClipboardCheck}
                iconLeftClassName={startMutation.isPending ? 'animate-spin' : undefined}
              >
                {startMutation.isPending ? 'Starting...' : 'Begin Counting'}
              </ButtonContent>
            </Button>
          </>
        )}

        {/* IN PROGRESS: Counting mode */}
        {status === 'in_progress' && (
          <>
            {/* Progress */}
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <Typography variant="bodySm" className="text-blue-800 dark:text-blue-300">
                {countedCount} of {totalItems} items counted
              </Typography>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: totalItems > 0 ? `${(countedCount / totalItems) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Item list with inputs */}
            <div className="space-y-3">
              {data.items.map((item) => {
                const isSaving = savingItemId === item.id;
                const hasBeenCounted = item.countedQuantity !== null;
                const currentValue = countedValues[item.id] ?? (hasBeenCounted ? String(item.countedQuantity) : '');

                return (
                  <Card key={item.id} className={hasBeenCounted ? 'border-green-200 dark:border-green-800' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        {hasBeenCounted && (
                          <Icon icon={IconCheck} size="sm" className="text-green-600" />
                        )}
                        <div className="flex-1">
                          <Typography variant="bodySm" className="font-medium">
                            {item.productName}
                          </Typography>
                          <Typography variant="bodySm" colorRole="muted" className="font-mono text-xs">
                            {item.lwin18}
                          </Typography>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Typography variant="bodySm" colorRole="muted" className="whitespace-nowrap">
                          Expected: {item.expectedQuantity}
                        </Typography>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={currentValue}
                          onChange={(e) =>
                            setCountedValues((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Qty"
                          className="h-12 w-24 rounded-lg border border-border-muted bg-fill-primary px-3 text-center text-lg font-semibold focus:border-border-brand focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveItem(item.id)}
                          disabled={isSaving || currentValue === ''}
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
                            hasBeenCounted
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-fill-brand text-white'
                          }`}
                        >
                          {isSaving ? (
                            <Icon icon={IconLoader2} size="md" className="animate-spin" />
                          ) : (
                            <Icon icon={IconCheck} size="md" />
                          )}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Complete Button */}
            <Button
              onClick={handleCompleteCount}
              disabled={completeMutation.isPending || countedCount < totalItems}
              className="w-full"
            >
              <ButtonContent
                iconLeft={completeMutation.isPending ? IconLoader2 : IconClipboardCheck}
                iconLeftClassName={completeMutation.isPending ? 'animate-spin' : undefined}
              >
                {completeMutation.isPending
                  ? 'Completing...'
                  : countedCount < totalItems
                    ? `Count ${totalItems - countedCount} more item${totalItems - countedCount !== 1 ? 's' : ''}`
                    : 'Complete Count'}
              </ButtonContent>
            </Button>
          </>
        )}

        {/* COMPLETED: Review & Reconcile */}
        {status === 'completed' && (
          <>
            {discrepancyItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8">
                  <Icon icon={IconCheck} size="lg" className="text-green-600" />
                  <Typography variant="bodySm" className="font-medium text-green-700 dark:text-green-400">
                    No discrepancies found — all counts match!
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Typography variant="bodySm" className="font-medium">
                    {discrepancyItems.length} Discrepanc{discrepancyItems.length === 1 ? 'y' : 'ies'} Found
                  </Typography>
                  <button
                    onClick={toggleAllApprovals}
                    className="text-xs font-medium text-brand-teal hover:underline"
                  >
                    {discrepancyItems.every((i) => approvals[i.id]) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2">
                  {discrepancyItems.map((item) => {
                    const disc = item.discrepancy ?? 0;
                    const isShortage = disc < 0;

                    return (
                      <Card
                        key={item.id}
                        className={`cursor-pointer transition-colors ${approvals[item.id] ? 'border-brand-teal' : ''}`}
                        onClick={() => toggleApproval(item.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={approvals[item.id] ?? false}
                              onChange={() => toggleApproval(item.id)}
                              className="h-5 w-5 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                            />
                            <div className="flex-1">
                              <Typography variant="bodySm" className="font-medium">
                                {item.productName}
                              </Typography>
                              <Typography variant="bodySm" colorRole="muted" className="font-mono text-xs">
                                {item.lwin18}
                              </Typography>
                              <div className="mt-1 flex gap-4 text-xs">
                                <span className="text-text-muted">Expected: {item.expectedQuantity}</span>
                                <span className="font-medium">Counted: {item.countedQuantity}</span>
                                <span className={`font-semibold ${isShortage ? 'text-red-600' : 'text-amber-600'}`}>
                                  {isShortage ? '' : '+'}{disc}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {/* Items that matched */}
            {data.items.filter((i) => i.discrepancy === 0).length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <Typography variant="bodySm" className="mb-2 font-medium text-green-700 dark:text-green-400">
                    {data.items.filter((i) => i.discrepancy === 0).length} item{data.items.filter((i) => i.discrepancy === 0).length !== 1 ? 's' : ''} matched
                  </Typography>
                  <div className="space-y-1">
                    {data.items
                      .filter((i) => i.discrepancy === 0)
                      .map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs text-text-muted">
                          <span>{item.productName}</span>
                          <span>{item.expectedQuantity} cases</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reconcile Button */}
            <Button
              onClick={handleReconcile}
              disabled={reconcileMutation.isPending}
              className="w-full"
            >
              <ButtonContent
                iconLeft={reconcileMutation.isPending ? IconLoader2 : IconCheck}
                iconLeftClassName={reconcileMutation.isPending ? 'animate-spin' : undefined}
              >
                {reconcileMutation.isPending
                  ? 'Reconciling...'
                  : discrepancyItems.length === 0
                    ? 'Mark as Reconciled'
                    : `Reconcile (${approvedCount} adjustment${approvedCount !== 1 ? 's' : ''} approved)`}
              </ButtonContent>
            </Button>
          </>
        )}

        {/* RECONCILED: Read-only summary */}
        {status === 'reconciled' && (
          <>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Icon icon={IconCheck} size="lg" className="text-green-600" />
                <Typography variant="bodySm" className="font-medium text-green-700 dark:text-green-400">
                  This count has been reconciled
                </Typography>
                {data.completedAt && (
                  <Typography variant="bodySm" colorRole="muted">
                    Completed {new Date(data.completedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Typography variant="bodySm" className="mb-3 font-medium">
                  Count Summary
                </Typography>
                <div className="space-y-2">
                  {data.items.map((item) => {
                    const disc = item.discrepancy ?? 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-fill-secondary p-3">
                        <div>
                          <Typography variant="bodySm" className="font-medium">{item.productName}</Typography>
                          <Typography variant="bodySm" colorRole="muted" className="font-mono text-xs">
                            {item.lwin18}
                          </Typography>
                        </div>
                        <div className="text-right">
                          <Typography variant="bodySm" className="font-semibold">
                            {item.countedQuantity} cases
                          </Typography>
                          {disc !== 0 && (
                            <Typography
                              variant="bodySm"
                              className={`text-xs font-medium ${disc < 0 ? 'text-red-600' : 'text-amber-600'}`}
                            >
                              {disc < 0 ? '' : '+'}{disc} from expected
                            </Typography>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default CycleCountDetailPage;
