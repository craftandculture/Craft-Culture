'use client';

import { IconChevronDown, IconChevronRight, IconPackage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';

import useTRPC from '@/lib/trpc/browser';

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/** This month and the two before it, as YYYY-MM in Dubai */
const recentMonths = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit' });
  const now = new Date();
  return [0, 1, 2].map((back) => fmt.format(new Date(now.getFullYear(), now.getMonth() - back, 15)));
};

const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00+04:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/**
 * Repacks per member for a month, to add to their warehouse services invoice
 *
 * One line per member who had packages built for their own deliveries or
 * collections; open a member to see which deliveries they were for.
 */
const RepacksList = () => {
  const api = useTRPC();
  const months = recentMonths();
  const [month, setMonth] = useState(months[0]!);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery(api.cellar.admin.getRepacks.queryOptions({ month }));

  const members = data?.members ?? [];
  const total = members.reduce((sum, member) => sum + member.aed, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconPackage size={16} className="text-text-muted" />
          <p className="text-text-muted text-sm">
            Repacks · {monthLabel(month)}:{' '}
            <span className="text-text-primary font-semibold">{aed(total)}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {months.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMonth(item)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                item === month ? 'bg-text-primary text-surface-primary' : 'bg-fill-muted text-text-muted hover:text-text-primary'
              }`}
            >
              {monthLabel(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border-muted bg-surface-primary overflow-x-auto rounded-xl border shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-text-muted border-border-muted border-b text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-right">Repacks</th>
              <th className="px-4 py-2 text-right">Add to invoice</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && members.length === 0 && (
              <tr>
                <td colSpan={3} className="text-text-muted px-4 py-8 text-center">
                  No repacks in {monthLabel(month)}.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <Fragment key={member.ownerId}>
                <tr
                  className="border-border-muted hover:bg-surface-secondary/50 cursor-pointer border-b last:border-b-0"
                  onClick={() => setOpen(open === member.ownerId ? null : member.ownerId)}
                >
                  <td className="text-text-primary px-4 py-2.5 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {open === member.ownerId ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      {member.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {member.packages} {member.packages === 1 ? 'repack' : 'repacks'}
                  </td>
                  <td className="text-text-primary px-4 py-2.5 text-right font-semibold tabular-nums">{aed(member.aed)}</td>
                </tr>
                {open === member.ownerId &&
                  member.lines.map((line) => (
                    <tr key={line.reference} className="bg-fill-muted/30 border-border-muted border-b text-xs">
                      <td className="text-text-secondary py-2 pl-10 pr-4">
                        <span className="font-mono">{line.reference}</span>
                        <span className="text-text-muted">
                          {' '}
                          · {new Date(line.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
                          {line.looseBottles} loose {line.looseBottles === 1 ? 'bottle' : 'bottles'}
                        </span>
                      </td>
                      <td className="text-text-muted px-3 py-2 text-right tabular-nums">
                        {line.packages} × {aed(data?.rateAed ?? 0)}
                      </td>
                      <td className="text-text-secondary px-4 py-2 text-right tabular-nums">{aed(line.aed)}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-text-muted text-xs leading-5">
        A repack is a package built for a member&apos;s own delivery or collection: box, packing materials and labour.
        Bottles leaving in their original sealed case need none; the rest go in packages of up to six, at{' '}
        {aed(data?.rateAed ?? 25)} each. Sales of their wine to others are never billed to them. Add the figure to the
        member&apos;s monthly invoice in Zoho with the storage.
      </p>
    </div>
  );
};

export default RepacksList;
