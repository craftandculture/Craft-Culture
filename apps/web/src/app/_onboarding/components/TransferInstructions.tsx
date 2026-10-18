'use client';

import { IconCopy } from '@tabler/icons-react';
import { toast } from 'sonner';

import lcbBurton from '../constants/lcbBurton';

export interface TransferInstructionsProps {
  /** Where the wine is now, as a wine source value */
  source: string;
  /** The member's reference, such as PC-1001; null before one is issued */
  reference: string | null;
}

/**
 * What a member can pass on to whoever holds their wine
 *
 * We contact the holder ourselves; this is for the member who would rather
 * instruct them directly, which is often quicker. Wine already at London City
 * Bond moves by a transfer inside LCB, with nothing physically moved; wine
 * anywhere else is sent to Burton under bond. Either way the member's
 * reference goes on the paperwork — it is how the wine is recognised as
 * theirs when it arrives.
 */
const TransferInstructions = ({ source, reference }: TransferInstructionsProps) => {
  const isAtLcb = source === 'lcb';

  const details = isAtLcb
    ? [
        ['Transfer to', `Craft & Culture at ${lcbBurton.name}`],
        ["C&C's reference at London City Bond", lcbBurton.reference],
        ['Postcode', lcbBurton.postcode],
        ...(reference ? [['Your reference, to quote', reference]] : []),
      ]
    : [
        [
          'Deliver under bond to',
          ['Craft & Culture', `c/o ${lcbBurton.name}`, ...lcbBurton.addressLines, lcbBurton.postcode].join(', '),
        ],
        ["C&C's reference at London City Bond", lcbBurton.reference],
        ['Delivery bookings', lcbBurton.goodsInEmail],
        ...(reference ? [['Your reference, to quote', reference]] : []),
      ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details.map(([label, value]) => `${label}: ${value}`).join('\n'));
      toast.success('Copied');
    } catch {
      toast.error('Could not copy. Please select the details instead.');
    }
  };

  return (
    <div className="border-border-muted bg-surface-secondary/40 rounded-lg border p-3 sm:p-4">
      <p className="text-text-primary text-sm font-semibold">
        {isAtLcb ? 'If you would like to instruct the merchant yourself' : 'If you would like to instruct them yourself'}
      </p>
      <p className="text-text-muted mt-1 text-xs leading-5">
        {isAtLcb
          ? 'Ask them to transfer your wine to us within London City Bond, keeping it under bond. LCB call this a Transfer – Retain Status. Nothing is moved, so it is usually done within days.'
          : 'Ask them to send your wine under bond to our UK bond at Burton. Wine coming from outside the UK needs a customs entry, so please tell us before it leaves and we will arrange it.'}
      </p>
      <dl className="mt-3 space-y-1.5 text-xs">
        {details.map(([label, value]) => (
          <div key={label} className="flex flex-col sm:flex-row sm:gap-3">
            <dt className="text-text-muted sm:w-56 sm:shrink-0">{label}</dt>
            <dd className="text-text-primary m-0 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {reference && (
          <p className="text-text-muted text-[11px] leading-4">
            Please make sure {reference} is quoted. It is how we recognise the wine as yours when it arrives.
          </p>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="border-border-muted text-text-primary hover:bg-fill-muted/40 ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"
        >
          <IconCopy size={13} /> Copy details
        </button>
      </div>
    </div>
  );
};

export default TransferInstructions;
