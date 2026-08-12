'use client';

import Typography from '@/app/_ui/components/Typography/Typography';

import formatBottles from '../utils/formatBottles';

export interface SummaryBarProps {
  ccReceived: number;
  ccSoldToCd: number;
  ccOnHand: number;
  cdSold: number;
  cdOnHand: number;
}

/**
 * The five headline figures in one strip rather than five cards
 *
 * As cards these took a full row and pushed the table — the thing anyone came
 * here for — below the fold. They are context, not the answer, so they earn one
 * line. Grouping them under the two party colours also states the key the table
 * then uses, without needing a legend.
 */
const SummaryBar = ({
  ccReceived,
  ccSoldToCd,
  ccOnHand,
  cdSold,
  cdOnHand,
}: SummaryBarProps) => {
  const groups = [
    {
      name: 'Craft & Culture',
      dot: 'bg-fill-brand',
      text: 'text-text-brand',
      figures: [
        { label: 'Received', value: ccReceived },
        { label: 'Sold to CD', value: ccSoldToCd },
        { label: 'On hand', value: ccOnHand },
      ],
    },
    {
      name: 'City Drinks',
      dot: 'bg-fill-info',
      text: 'text-text-info',
      figures: [
        { label: 'Sold through', value: cdSold },
        { label: 'On hand', value: cdOnHand },
      ],
    },
  ];

  return (
    <div className="border-border-primary bg-fill-primary flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3">
      {groups.map((group, index) => (
        <div key={group.name} className="flex items-center gap-5">
          {index > 0 ? (
            <span className="bg-border-primary -ml-4 hidden h-8 w-px lg:block" />
          ) : null}
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${group.dot}`} />
            <span
              className={`text-xs font-medium uppercase tracking-wide ${group.text}`}
            >
              {group.name}
            </span>
          </span>
          {group.figures.map((figure) => (
            <div key={figure.label}>
              <Typography variant="labelXs" colorRole="muted" asChild>
                <p className="leading-tight">{figure.label}</p>
              </Typography>
              <Typography variant="headingSm" asChild>
                <p className="tabular-nums leading-tight">
                  {formatBottles(figure.value)}
                </p>
              </Typography>
            </div>
          ))}
        </div>
      ))}
      <Typography variant="bodyXs" colorRole="muted" asChild>
        <span className="ml-auto">bottles</span>
      </Typography>
    </div>
  );
};

export default SummaryBar;
