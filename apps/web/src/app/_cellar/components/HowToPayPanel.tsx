'use client';

import { IconBuildingBank, IconCopy } from '@tabler/icons-react';
import { toast } from 'sonner';

export interface HowToPayPanelProps {
  details: {
    accountName?: string;
    bankName?: string;
    iban?: string;
    swiftBic?: string;
    accountNumber?: string;
    currency?: string;
    note?: string;
  } | null;
  amountUsd: number;
  reference: string;
}

const AED_PER_USD = 3.6725;

/**
 * Where and how much to pay for a reserved purchase, every figure copyable
 *
 * The purchase number is the reference, because it is the one thing that lets
 * the team match a transfer to an order without asking. Until the bank details
 * are set in Index, the member is told they will follow by email rather than
 * shown an empty box.
 */
const HowToPayPanel = ({ details, amountUsd, reference }: HowToPayPanelProps) => {
  const amount = `USD ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const amountAed = `AED ${(amountUsd * AED_PER_USD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows: { label: string; value: string | undefined; hint?: string; strong?: boolean }[] = [
    { label: 'Amount', value: amount, hint: `about ${amountAed}`, strong: true },
    { label: 'Reference', value: reference, hint: 'please include this exactly', strong: true },
    ...(details
      ? [
          { label: 'Account name', value: details.accountName },
          { label: 'Bank', value: details.bankName },
          { label: 'IBAN', value: details.iban },
          { label: 'SWIFT / BIC', value: details.swiftBic },
          { label: 'Account number', value: details.accountNumber },
        ]
      : []),
  ];
  const shown = rows.flatMap((row) => (row.value ? [{ ...row, value: row.value }] : []));

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-transparent p-4 dark:border-amber-900/50 dark:from-amber-500/10">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <IconBuildingBank size={16} />
        </span>
        <div>
          <p className="text-text-primary text-sm font-semibold">How to pay</p>
          <p className="text-text-muted text-xs leading-5">
            By bank transfer to Craft &amp; Culture{details?.currency ? `, in ${details.currency}` : ''}. Once it is
            sent, press &ldquo;I have paid&rdquo; so that we can confirm it.
          </p>
        </div>
      </div>

      <dl className="border-border-muted bg-surface-primary divide-border-muted divide-y rounded-lg border">
        {shown.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
              <dt className="text-text-muted text-[11px] sm:w-28 sm:flex-shrink-0 sm:text-xs">{row.label}</dt>
              <dd className="m-0 min-w-0 flex-1">
              <span
                className={`text-text-primary block break-all text-sm tabular-nums ${row.strong ? 'font-semibold' : ''} ${
                  row.label === 'IBAN' || row.label === 'Reference' ? 'font-mono' : ''
                }`}
              >
                {row.value}
              </span>
              {row.hint && <span className="text-text-muted block text-[11px]">{row.hint}</span>}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => void copy(row.label, row.value)}
              aria-label={`Copy ${row.label}`}
              className="text-text-muted hover:text-text-primary hover:bg-fill-muted flex size-10 flex-shrink-0 items-center justify-center rounded-md sm:size-8"
            >
              <IconCopy size={14} />
            </button>
          </div>
        ))}
      </dl>

      {!details && (
        <p className="text-text-muted mt-2 text-xs leading-5">
          We will email you our bank details shortly. If you need them sooner, please contact us and we will send them straight away.
        </p>
      )}
      {details?.note && <p className="text-text-muted mt-2 text-xs leading-5">{details.note}</p>}
    </div>
  );
};

export default HowToPayPanel;
