import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isStaff from '@/app/_distribution/utils/isStaff';
import Typography from '@/app/_ui/components/Typography/Typography';
import RunBatchForm from '@/app/_winelabs/components/RunBatchForm';
import getCoverageSummary from '@/app/_winelabs/data/getCoverageSummary';
import type { CoverageSummary } from '@/app/_winelabs/data/getCoverageSummary';

export const dynamic = 'force-dynamic';
// A batch of 25 wines is up to 75 calls
export const maxDuration = 300;

const STATUS = {
  agrees: { label: 'Agrees', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  different: { label: 'Different wine', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  not_found: { label: 'Not found', tone: 'bg-fill-muted text-text-muted' },
  internal_known: { label: 'Internal code known', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
} as const;

const usd = (value: number | null) =>
  value === null ? '—' : `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/** One KPI tile */
const Tile = ({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone: string }) => (
  <div className={`rounded-xl p-4 ${tone}`}>
    <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    {note && <div className="mt-0.5 text-xs opacity-80">{note}</div>}
  </div>
);

/** The checked wines, as a table */
const Rows = ({ rows }: { rows: CoverageSummary['exceptions'] }) => (
  <div className="overflow-x-auto rounded-xl border border-border-muted">
    <table className="w-full text-sm">
      <thead className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
        <tr>
          <th className="px-3 py-2">Our wine</th>
          <th className="px-3 py-2">Wine Labs name search</th>
          <th className="px-3 py-2 text-right">Bottles</th>
          <th className="px-3 py-2">Drinking window</th>
          <th className="px-3 py-2 text-right">Retail median</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-muted">
        {rows.map((row) => {
          const status = STATUS[row.matchStatus as keyof typeof STATUS] ?? STATUS.not_found;
          return (
            <tr key={row.lwin11}>
              <td className="px-3 py-2">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.tone}`}>
                  {status.label}
                </span>
                <span className="font-medium">{row.ourName}</span>
                <span className="text-text-muted"> {row.vintage === '1000' ? 'NV' : row.vintage}</span>
                <span className="block font-mono text-xs text-text-muted">{row.ourLwin7}</span>
              </td>
              <td className="px-3 py-2">
                {row.wlLwin7 ? (
                  <>
                    {row.wlDisplayName ?? '—'}
                    <span className="block font-mono text-xs text-text-muted">{row.wlLwin7}</span>
                  </>
                ) : (
                  <span className="text-text-muted">No match</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.bottles}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {row.drinkFrom ? `${row.drinkFrom}–${row.drinkTo ?? ''}` : <span className="text-text-muted">—</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {usd(row.priceMedianUsd)}
                {row.priceCount ? <span className="text-text-muted"> ({row.priceCount})</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/**
 * Wine Labs check — how well Wine Labs knows the wines we hold
 *
 * Runs our stock through Wine Labs a batch at a time and shows where its name
 * search disagrees with our LWIN, and how many wines it has prices and
 * drinking windows for. Nothing here changes our records: it is the evidence
 * for deciding which Wine Labs features to build. C&C staff only.
 */
const WineLabsPage = async () => {
  const user = await getUserOrRedirect();
  if (!isStaff(user)) redirect('/platform');

  const summary = await getCoverageSummary();
  const capReached = summary.credits >= summary.cap;
  const pct = (n: number) => (summary.checked ? `${Math.round((n / summary.checked) * 100)}%` : '—');

  return (
    <main className="container space-y-8 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Wine Labs check</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Our stock checked against Wine Labs: whether a search by name finds the LWIN we hold, and whether
            Wine Labs has a drinking window and a market price for it. Prices are retail, mostly duty-paid, in
            USD, worldwide; they are not our in-bond prices. Nothing on this page changes our records. C&amp;C
            staff only.
          </p>
        </Typography>
      </div>

      {!summary.configured && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Wine Labs is not connected. Add the account key as <code>WINELABS_USER_ID</code> in Vercel, then
          redeploy.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Credits this month"
          value={summary.credits.toLocaleString('en-US')}
          note={`of ${summary.cap.toLocaleString('en-US')} cap`}
          tone={capReached ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200' : 'bg-fill-muted'}
        />
        <Tile
          label="Wines checked"
          value={summary.checked}
          note={`of ${summary.inStock} in stock`}
          tone="bg-fill-muted"
        />
        <Tile
          label="Name search agrees"
          value={pct(summary.agrees)}
          note={`${summary.agrees} wines`}
          tone="bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
        />
        <Tile
          label="Has a market price"
          value={pct(summary.hasPrice)}
          note={`${summary.hasWindow} with a drinking window`}
          tone="bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-200"
        />
      </div>

      <RunBatchForm defaultSize={summary.credits < 100 ? 3 : 25} disabled={!summary.configured || capReached} />

      {summary.lastError && (
        <p className="text-xs text-text-muted">
          Last Wine Labs error ({summary.lastError.endpoint},{' '}
          {summary.lastError.at.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}): {summary.lastError.error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          To look at
          <span className="ml-2 font-normal text-text-muted">
            {summary.different} different wine · {summary.internalKnown} internal code known ·{' '}
            {summary.notFound} not found
          </span>
        </h2>
        <p className="text-xs text-text-muted">
          A different wine is usually the same producer, another cuvée: check which is right before changing
          anything. An internal code Wine Labs can name may have a real LWIN to move to.
        </p>
        {summary.exceptions.length ? (
          <Rows rows={summary.exceptions} />
        ) : (
          <p className="text-sm text-text-muted">Nothing yet.</p>
        )}
      </section>

      {summary.sample.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Agrees (largest holdings)</h2>
          <Rows rows={summary.sample} />
        </section>
      )}
    </main>
  );
};

export default WineLabsPage;
