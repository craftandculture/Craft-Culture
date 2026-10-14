import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import getOutletReorderList from '@/app/_distribution/data/getOutletReorderList';
import type { ReorderLine } from '@/app/_distribution/data/getOutletReorderList';
import isStaff from '@/app/_distribution/utils/isStaff';
import Typography from '@/app/_ui/components/Typography/Typography';
import { client } from '@/database/client';

export const dynamic = 'force-dynamic';

const canSend = (line: ReorderLine) =>
  line.status !== 'oneoff' &&
  ((line.supply?.stock ?? 0) + (line.supply?.consignor ?? 0) + (line.supply?.inbound ?? 0) > 0 ||
    line.alternatives.length > 0);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });

const supplyOf = (line: ReorderLine) => {
  const s = line.supply;
  const parts: string[] = [];
  if (s?.stock) parts.push(`${s.stock} at C&C`);
  if (s?.consignor) parts.push(`${s.consignor} ${s.consignorName ?? 'consignor'} at C&C`);
  if (s?.inbound) parts.push(`${s.inbound} inbound${s.inboundEta ? ` ${shortDate(s.inboundEta)}` : ''}`);
  if (parts.length) return parts.join(' · ');
  if (line.alternatives.length) {
    return `Other vintage: ${line.alternatives
      .map((a) => `${a.vintage} (${a.stock ? `${a.stock} btl` : 'inbound'})`)
      .join(', ')}`;
  }
  return '—';
};

const STATUS = {
  oos: { label: 'Out', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  low: { label: 'Low', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  oneoff: { label: 'One-off', tone: 'bg-fill-muted text-text-muted' },
} as const;

/** One table of reorder lines */
const Lines = ({ lines, showSupply }: { lines: ReorderLine[]; showSupply: boolean }) => (
  <div className="overflow-x-auto rounded-xl border border-border-muted">
    <table className="w-full text-sm">
      <thead className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
        <tr>
          <th className="px-3 py-2">Wine</th>
          <th className="px-3 py-2">Owner</th>
          <th className="px-3 py-2 text-right">Sold 30d / 90d</th>
          <th className="px-3 py-2 text-right">On shelf</th>
          {showSupply && <th className="px-3 py-2 text-right">Send</th>}
          {showSupply && <th className="px-3 py-2">From</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-muted">
        {lines.map((line) => (
          <tr key={`${line.lwin18}-${line.owner}`}>
            <td className="px-3 py-2">
              <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[line.status].tone}`}>
                {STATUS[line.status].label}
              </span>
              <span className="font-medium">{line.wine}</span>
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-text-muted">{line.owner}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {line.sold30} / {line.sold90}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {line.held}
              {line.status === 'low' && line.daysCover !== null && (
                <span className="text-text-muted"> (~{line.daysCover}d)</span>
              )}
              {line.inTransit > 0 && <span className="text-text-muted"> +{line.inTransit} coming</span>}
            </td>
            {showSupply && (
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                {line.unit === 'case' ? `${line.suggestCases} cs` : `${line.suggestBottles} btl`}
              </td>
            )}
            {showSupply && <td className="px-3 py-2 text-text-muted">{supplyOf(line)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Reorder watch — the full list behind the daily #cd-stock-levels post
 *
 * The post names the first wines to source and says how many more there are;
 * this page has every one. Same data and rules as the post, read live from
 * the distributor's latest stock count. C&C staff only: it shows every
 * consignor's position.
 */
const ReorderWatchPage = async () => {
  const user = await getUserOrRedirect();
  if (!isStaff(user)) redirect('/platform');

  const outlets = await client<{ id: string; name: string }[]>`
    SELECT id, name FROM cons_outlets WHERE is_active AND connector = 'api' ORDER BY name
  `;
  const lists = await Promise.all(
    outlets.map(async (outlet) => ({ outlet, ...(await getOutletReorderList(outlet.id)) })),
  );

  return (
    <main className="container space-y-8 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Reorder watch</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Wines the distributor is out of (sold in the last 30 days) or has under 14 days of stock
            for, from their latest count. To send: we, or the consignor, hold it or have it inbound.
            To source: nobody holds it, then one-offs that sold this quarter but not this month.
            C&amp;C staff only.
          </p>
        </Typography>
      </div>

      {lists.map(({ outlet, takenAt, lines }) => {
        const toSend = lines.filter(canSend);
        const toSource = lines.filter((l) => !canSend(l));
        return (
          <section key={outlet.id} className="space-y-5">
            <Typography variant="headingSm" asChild>
              <h2>
                {outlet.name}
                <span className="ml-2 text-sm font-normal text-text-muted">
                  stock as of{' '}
                  {takenAt
                    ? new Date(takenAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Dubai',
                      })
                    : 'unknown'}{' '}
                  · {toSend.length} to send · {toSource.length} to source
                </span>
              </h2>
            </Typography>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">To send</h3>
              {toSend.length ? <Lines lines={toSend} showSupply /> : <p className="text-sm text-text-muted">Nothing.</p>}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">To source</h3>
              {toSource.length ? <Lines lines={toSource} showSupply={false} /> : <p className="text-sm text-text-muted">Nothing.</p>}
            </div>
          </section>
        );
      })}
    </main>
  );
};

export default ReorderWatchPage;
