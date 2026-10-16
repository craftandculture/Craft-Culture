'use client';

import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

export interface CellarOpenedProps {
  firstName: string | null;
}

/**
 * The payoff after the last step, for a member whose cellar opens at once
 *
 * Ending on a generic "submitted" page made opening a cellar feel like filing
 * a form. This says it is open and takes them straight in.
 */
const CellarOpened = ({ firstName }: CellarOpenedProps) => (
  <div className="bg-fill-primary border-border-muted space-y-5 rounded-2xl border p-6 text-center shadow-sm sm:p-10">
    <p className="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">Private Cellar</p>
    <h1 className="font-heading text-text-primary text-2xl leading-tight sm:text-3xl">
      Welcome to your Private Cellar{firstName ? `, ${firstName}` : ''}.
    </h1>
    <p className="text-text-primary text-base">Your cellar is now open.</p>
    <p className="text-text-muted mx-auto max-w-md text-sm leading-6">
      There is nothing to pay today. Your membership will begin when you first use your cellar, and we will confirm
      this with you beforehand.
    </p>
    <Link
      href="/platform/cellar"
      className="bg-text-primary text-surface-primary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-8 text-base font-semibold"
    >
      Enter my cellar
      <IconArrowRight size={18} />
    </Link>
  </div>
);

export default CellarOpened;
