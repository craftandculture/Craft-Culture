'use client';

import { IconLoader2, IconRefresh } from '@tabler/icons-react';

import Typography from '@/app/_ui/components/Typography/Typography';

export interface LondonMarket {
  bidUsd: number | null;
  askUsd: number | null;
  lastUsd: number | null;
  lastTradedAt: Date | string | null;
  checkedAt: Date | string;
}

/**
 * Our in-bond price against London's, for a line about to go to a client
 *
 * The last trade leads (what it actually changed hands for), the lowest ask
 * when it has never traded. Below London is flagged: we may be
 * giving margin away. A check only; the quote's price is never changed.
 */
const LondonCheck = ({
  market,
  ours,
  canAsk,
  asking,
  onAsk,
}: {
  market?: LondonMarket;
  ours: number;
  canAsk: boolean;
  asking: boolean;
  onAsk: () => void;
}) => {
  if (!canAsk) return null;
  const lead = market ? (market.lastUsd ?? market.askUsd) : null;
  const gap = lead && ours > 0 ? Math.round(((ours - lead) / lead) * 100) : null;
  const checked = market
    ? new Date(market.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <Typography variant="bodyXs" colorRole="muted" asChild>
      <p className="flex flex-wrap items-center gap-x-1">
        {lead == null ? (
          <span>London in bond: no price yet</span>
        ) : (
          <>
            <span>
              London in bond {market?.lastUsd == null ? 'ask' : 'last trade'} ${lead.toFixed(0)}
            </span>
            {gap != null && (
              <span className={gap < 0 ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>
                · ours {gap > 0 ? `+${gap}` : gap}%{gap < 0 ? ', below London' : ''}
              </span>
            )}
            <span>· checked {checked}</span>
          </>
        )}
        <button
          type="button"
          onClick={onAsk}
          disabled={asking}
          title="Ask Wine Labs for today's London price (15 to 30 credits)"
          className="inline-flex items-center gap-0.5 hover:text-text-primary disabled:opacity-50"
        >
          {asking ? <IconLoader2 className="size-3 animate-spin" /> : <IconRefresh className="size-3" />}
          {lead == null ? 'Ask now' : 'Refresh'}
        </button>
      </p>
    </Typography>
  );
};

export default LondonCheck;
