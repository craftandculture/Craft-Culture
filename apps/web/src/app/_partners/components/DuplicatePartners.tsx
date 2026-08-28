'use client';

import { IconAlertTriangle, IconArrowRight, IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * One business recorded twice, and the way to put it back together
 *
 * Owner pricing settings are keyed on the partner id, so a margin set against
 * one record does not reach stock held under the other: the rate reads as
 * configured while half the wine prices as though it were not. The same split
 * shows the owner twice in every filter, each holding part of the total.
 *
 * Nothing merges without being previewed first. The preview names every table
 * and row count that would move, because "merge these two" is easy to say and
 * hard to undo, and which record survives is a judgement about which one the
 * rest of the business already knows.
 *
 * @returns The panel, or nothing at all when there are no duplicates
 */
const DuplicatePartners = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    api.partners.findDuplicates.queryOptions(),
  );

  /** Which record keeps its identity, per group */
  const [survivors, setSurvivors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    key: string;
    survivor: string;
    duplicate: string;
    moved: { table: string; column: string; rows: number; discard: boolean }[];
    totalRows: number;
  } | null>(null);

  const { mutate: merge, isPending } = useMutation(
    api.partners.merge.mutationOptions({
      onSuccess: (result) => {
        if (result.dryRun) {
          setPreview({
            key: `${result.survivor}|${result.duplicate}`,
            survivor: result.survivor,
            duplicate: result.duplicate,
            moved: result.moved,
            totalRows: result.totalRows,
          });

          if (result.totalRows === 0) {
            toast.info(
              `"${result.duplicate}" holds nothing — merging simply retires it.`,
            );
          }

          return;
        }

        toast.success(
          `Moved ${result.totalRows} row${result.totalRows === 1 ? '' : 's'} onto "${result.survivor}"`,
        );
        setPreview(null);
        void queryClient.invalidateQueries();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (isLoading || !data?.groups.length) return null;

  return (
    <div className="border-border-warning bg-fill-warning/10 mb-6 rounded-lg border p-4">
      <div className="mb-1 flex items-center gap-2">
        <Icon icon={IconAlertTriangle} size="md" colorRole="warning" />
        <Typography variant="headingSm">
          {data.groups.length} business{data.groups.length === 1 ? '' : 'es'}{' '}
          recorded more than once
        </Typography>
      </div>
      <Typography variant="bodyXs" colorRole="muted" className="mb-4">
        Pricing margins are held against a partner record, so a rate set on one
        of these does not apply to stock owned by the other. Each also appears
        separately in every owner filter, holding part of the total.
      </Typography>

      <div className="flex flex-col gap-4">
        {data.groups.map((group) => {
          const key = group.businessName;
          // Default to whichever record the business already runs through
          const suggested =
            [...group.records].sort(
              (a, b) =>
                b.stockCases - a.stockCases ||
                b.shipments - a.shipments ||
                Number(b.hasPricingSettings) - Number(a.hasPricingSettings),
            )[0]?.id ?? '';
          const survivorId = survivors[key] ?? suggested;
          const duplicates = group.records.filter((r) => r.id !== survivorId);

          return (
            <div
              key={key}
              className="border-border-muted bg-surface-primary rounded-md border p-3"
            >
              <Typography variant="labelSm" className="mb-2 block">
                {group.businessName}
              </Typography>

              <div className="mb-3 flex flex-col gap-1">
                {group.records.map((record) => (
                  <label
                    key={record.id}
                    className="hover:bg-fill-muted/40 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1"
                  >
                    <input
                      type="radio"
                      name={`survivor-${key}`}
                      checked={record.id === survivorId}
                      onChange={() => {
                        setSurvivors((s) => ({ ...s, [key]: record.id }));
                        setPreview(null);
                      }}
                    />
                    <span className="flex-1 text-sm">
                      {record.businessName}
                      <span className="text-text-muted ml-2 text-xs">
                        {[
                          `${record.stockCases} cases`,
                          `${record.shipments} shipment${record.shipments === 1 ? '' : 's'}`,
                          record.hasPricingSettings ? 'has margins' : 'no margins',
                          record.status,
                        ].join(' · ')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                Keeps its name and receives everything the others hold. The
                others are retired, not deleted, so an old reference still
                resolves.
              </Typography>

              <div className="flex flex-wrap items-center gap-2">
                {duplicates.map((duplicate) => {
                  const previewKey = `${group.records.find((r) => r.id === survivorId)?.businessName}|${duplicate.businessName}`;
                  const shown = preview?.key === previewKey ? preview : null;

                  return (
                    <div key={duplicate.id} className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant={shown ? 'default' : 'outline'}
                        isDisabled={isPending}
                        onClick={() =>
                          merge({
                            survivorId,
                            duplicateId: duplicate.id,
                            dryRun: !shown,
                          })
                        }
                      >
                        <ButtonContent
                          iconLeft={isPending ? IconLoader2 : IconArrowRight}
                        >
                          {shown
                            ? `Merge ${shown.totalRows} row${shown.totalRows === 1 ? '' : 's'} — confirm`
                            : `Preview merging "${duplicate.businessName}"`}
                        </ButtonContent>
                      </Button>

                      {shown ? (
                        <Typography variant="bodyXs" colorRole="muted">
                          {shown.moved.length === 0
                            ? 'Holds nothing — merging only retires the record.'
                            : [
                                shown.moved
                                  .filter((m) => !m.discard)
                                  .map((m) => `${m.rows}× ${m.table}`)
                                  .join(' · '),
                                // Named separately: a row that is dropped is
                                // not a row that moved, and the difference
                                // matters to whoever presses the button
                                shown.moved.filter((m) => m.discard).length > 0
                                  ? `discarded (this record's own kept on the survivor): ${shown.moved
                                      .filter((m) => m.discard)
                                      .map((m) => m.table)
                                      .join(', ')}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' — ')}
                        </Typography>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DuplicatePartners;
