'use client';

import { useQuery } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import describeLwin18 from '../utils/describeLwin18';

/**
 * Wines recorded twice, and what folding them together would move
 *
 * Deliberately has no merge button. Sophie asked to see the list before
 * anything is deleted, and a screen that proposes and cannot act keeps that
 * promise by construction rather than by anyone's discipline. Merging comes
 * next, as its own confirmed step, once this list has been read.
 *
 * Each record shows what it is carrying — warehouse bottles, consignment
 * lines, bottles invoiced out — because that is what a wrong merge costs. A
 * record holding nothing is free to fold away; one holding an owner's
 * position is not, and the difference belongs on the screen rather than in
 * the reviewer's head.
 */
const DuplicateWinesPanel = () => {
  const api = useTRPC();
  const duplicates = useQuery(
    api.distribution.admin.getDuplicateWines.queryOptions(),
  );

  const data = duplicates.data;

  if (duplicates.isLoading) {
    return (
      <Typography variant="bodySm" colorRole="muted" asChild>
        <p>Looking for wines recorded twice…</p>
      </Typography>
    );
  }

  if (duplicates.isError) {
    return (
      <div className="border-border-danger bg-fill-danger/5 rounded-xl border p-6">
        <Typography variant="bodySm" colorRole="danger" asChild>
          <p className="font-medium">The duplicates could not be read.</p>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1">{duplicates.error.message}</p>
        </Typography>
      </div>
    );
  }

  if (!data) return null;

  const member = (
    row: NonNullable<typeof data>['groups'][number]['survivor'],
    role: 'survivor' | 'duplicate',
  ) => (
    <div
      key={row.id}
      className={`rounded-lg border p-2 ${
        role === 'survivor'
          ? 'border-text-primary bg-fill-muted/20'
          : 'border-border-primary'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <Typography variant="bodyXs" asChild>
          <span className="font-medium">{row.name}</span>
        </Typography>
        <Badge size="xs" colorRole={role === 'survivor' ? 'primary' : 'muted'}>
          {role === 'survivor' ? 'keeps' : 'folds in'}
        </Badge>
      </div>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <span className="block tabular-nums">
          {row.lwin18} · {describeLwin18(row.lwin18) ?? ''}
        </span>
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <span className="block tabular-nums">
          {row.stockBottles} btl in stock · {row.consignedBottles} btl consigned
          out · {row.movementLines} lines
        </span>
      </Typography>
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <Typography variant="labelSm" asChild>
          <h2>Wines recorded twice</h2>
        </Typography>
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            {data.groups.length} to review. Nothing here is merged or deleted —
            this proposes, and merging is a separate step once the list has been
            read. The record keeping the most history survives, so the least is
            moved.
          </p>
        </Typography>
      </div>

      {data.groups.length === 0 ? (
        <Typography variant="bodyXs" colorRole="muted" asChild>
          <p>No wine appears twice. Nothing to merge.</p>
        </Typography>
      ) : (
        <div className="space-y-3">
          {data.groups.map((group) => (
            <div
              key={group.survivor.id}
              className="border-border-primary space-y-2 rounded-xl border p-3"
            >
              <Typography variant="bodyXs" colorRole="muted" asChild>
                <p>{group.reason}</p>
              </Typography>
              <div className="grid gap-2 md:grid-cols-2">
                {member(group.survivor, 'survivor')}
                {group.duplicates.map((row) => member(row, 'duplicate'))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.miscodedVintages.some((entry) => entry.matches.length > 0) ? (
        <div className="space-y-2">
          <Typography variant="labelSm" asChild>
            <h2>Codes carrying the wrong vintage</h2>
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" asChild>
            <p className="max-w-3xl">
              Not duplicates, and not merged. There is one wine; its code is
              wrong. Re-keying moves which lot its bottles belong to, so each is
              confirmed on its own rather than folded into a merge nobody reads.
            </p>
          </Typography>
          {data.miscodedVintages.map((entry) => (
            <div
              key={entry.wine}
              className="border-border-primary rounded-xl border p-3"
            >
              <Typography variant="bodyXs" asChild>
                <p className="font-medium">
                  {entry.wine} — coded {entry.codedAs}, actually{' '}
                  {entry.actually}
                </p>
              </Typography>
              {entry.matches.length === 0 ? (
                <Typography variant="bodyXs" colorRole="muted" asChild>
                  <p>Nothing on file matches that name.</p>
                </Typography>
              ) : (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {entry.matches.map((row) => member(row, 'duplicate'))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DuplicateWinesPanel;
