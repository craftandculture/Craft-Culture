import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isStaff from '@/app/_distribution/utils/isStaff';
import Typography from '@/app/_ui/components/Typography/Typography';
import LwinReviewList from '@/app/_winelabs/components/LwinReviewList';
import RunBatchForm from '@/app/_winelabs/components/RunBatchForm';
import RunInBondForm from '@/app/_winelabs/components/RunInBondForm';
import getCoverageSummary from '@/app/_winelabs/data/getCoverageSummary';
import type { CoverageSummary } from '@/app/_winelabs/data/getCoverageSummary';
import getInBondSummary from '@/app/_winelabs/data/getInBondSummary';
import type { InBondSummary } from '@/app/_winelabs/data/getInBondSummary';
import getLwinReview from '@/app/_winelabs/data/getLwinReview';

export const dynamic = 'force-dynamic';
// A batch of 25 wines is up to 75 calls; 50 wines priced in London up to 100
export const maxDuration = 300;

const STATUS = {
  agrees: { label: 'Agrees', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  different: { label: 'Different wine', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  not_found: { label: 'Not found', tone: 'bg-fill-muted text-text-muted' },
  internal_known: { label: 'Internal code known', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  checking: { label: 'Checking', tone: 'bg-fill-muted text-text-muted' },
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
                {row.info && (
                  <details className="mt-1 text-xs text-text-muted">
                    <summary className="cursor-pointer">Wine Labs details</summary>
                    <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap rounded bg-fill-muted p-2">
                      {JSON.stringify(row.info, null, 2)}
                    </pre>
                  </details>
                )}
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

const VENUES: Record<string, string> = {
  bordeaux_index: 'Bordeaux Index',
  bbx: 'BBX',
  wine_collector: 'Wine Collector',
  cult_wines: 'Cult Wines',
  cultx: 'CultX',
};

/** The London in-bond prices, largest holdings first */
const InBondRows = ({ rows }: { rows: InBondSummary['rows'] }) => (
  <div className="overflow-x-auto rounded-xl border border-border-muted">
    <table className="w-full text-sm">
      <thead className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
        <tr>
          <th className="px-3 py-2">Our wine</th>
          <th className="px-3 py-2 text-right">Bottles</th>
          <th className="px-3 py-2 text-right">Best bid</th>
          <th className="px-3 py-2 text-right">Best ask</th>
          <th className="px-3 py-2 text-right">Last trade</th>
          <th className="px-3 py-2">Where</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-muted">
        {rows.map((row) => (
          <tr key={`${row.lwin11}:${row.format}`}>
            <td className="px-3 py-2">
              <span className="font-medium">{row.name}</span>
              <span className="text-text-muted"> {row.vintage === '1000' ? 'NV' : row.vintage}</span>
              {row.format !== '750' && (
                <span className="text-text-muted"> · {Number(row.format) / 10}cl</span>
              )}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.bottles}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{usd(row.bidUsd)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{usd(row.askUsd)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {usd(row.lastUsd)}
              {row.lastTradedAt && (
                <span className="block text-xs text-text-muted">
                  {row.lastTradedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-xs text-text-muted">
              {row.venues.map((venue) => VENUES[venue] ?? venue).join(', ')}
            </td>
          </tr>
        ))}
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

  const [summary, inBond, review] = await Promise.all([getCoverageSummary(), getInBondSummary(), getLwinReview()]);
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
          label="Credits logged this month"
          value={summary.credits.toLocaleString('en-US')}
          note={`at list rates, of ${summary.cap.toLocaleString('en-US')} cap`}
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
          note={`details for ${summary.hasInfo} · ${summary.hasWindow} with a drinking window`}
          tone="bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-200"
        />
      </div>

      <RunBatchForm defaultSize={3} disabled={!summary.configured || capReached} />

      {summary.lastError && (
        <p className="text-xs text-text-muted">
          Last Wine Labs error ({summary.lastError.endpoint},{' '}
          {summary.lastError.at.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}): {summary.lastError.error}
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            London in-bond prices
            <span className="ml-2 font-normal text-text-muted">
              {inBond.priced} priced · {inBond.unlisted} not listed · {inBond.inStock - inBond.checked} still to
              ask
            </span>
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-text-muted">
            What each bottle size we hold (75cl, magnum and larger) bids, asks and last traded for in bond on the London exchanges Wine Labs reads
            (Bordeaux Index, BBX and others; not Liv-ex), in USD. Our UAE in-bond price carries freight to Dubai,
            so expect it above London. These prices also show beside In Bond in the Pricing Manager.
          </p>
        </div>
        <RunInBondForm defaultSize={10} disabled={!summary.configured || capReached} />
        {inBond.rows.length > 0 && <InBondRows rows={inBond.rows.slice(0, 50)} />}
      </section>

      {summary.calls.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Calls this month</h2>
          <p className="text-xs text-text-muted">
            Credits here are counted at Wine Labs&apos; list rates, which is the safe side for the cap. What is
            actually billed is on the Data API page at winelabs.ai and has been lower.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border-muted">
            <table className="w-full text-sm">
              <thead className="border-b border-border-muted text-left text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2">Endpoint</th>
                  <th className="px-3 py-2">Response</th>
                  <th className="px-3 py-2 text-right">Calls</th>
                  <th className="px-3 py-2 text-right">Credits logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {summary.calls.map((call) => (
                  <tr key={`${call.endpoint}-${call.status}`}>
                    <td className="px-3 py-2 font-mono text-xs">{call.endpoint}</td>
                    <td className="px-3 py-2 tabular-nums">{call.status || 'unreachable'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{call.calls}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{call.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          LWIN fix list
          <span className="ml-2 font-normal text-text-muted">
            {review.filter((row) => row.verdict === 'likely_wrong').length} likely wrong ·{' '}
            {review.filter((row) => row.verdict === 'check').length} to check by hand ·{' '}
            {review.filter((row) => row.review === 'change').length} marked to change · {summary.notFound} not
            found by name
          </span>
        </h2>
        <p className="max-w-3xl text-xs text-text-muted">
          Codes on our stock that Wine Labs&apos; name search placed on a different wine. Both codes are looked up
          in the LWIN register and our product name is read against each: the one it reads as is probably right.
          Recording a call changes nothing on our stock; the wines marked to change are then recoded deliberately,
          as the code is also the Zoho SKU and the label barcode.
        </p>
        <LwinReviewList rows={review} />
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
