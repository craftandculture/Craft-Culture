'use client';

import authBrowserClient from '@/lib/better-auth/browser';

import ContactLinks from './ContactLinks';

export interface TradeAccountNoticeProps {
  businessName: string;
  email: string;
}

/** Shown when a business login opens the Private Cellar application */
const TradeAccountNotice = ({ businessName, email }: TradeAccountNoticeProps) => (
  <div className="bg-fill-primary border-border-muted space-y-4 rounded-2xl border p-6 shadow-sm sm:p-7">
    <h1 className="font-heading text-text-primary text-2xl leading-tight">Please use a personal email</h1>
    <p className="text-text-muted text-sm leading-6">
      {email} is already used for the {businessName} business account. A Private Cellar is held in your own name, so
      it needs an email address of its own. Please sign out and begin again with a different address.
    </p>
    <button
      type="button"
      onClick={() =>
        void authBrowserClient.signOut({
          fetchOptions: { onSuccess: () => window.location.assign('/join') },
        })
      }
      className="bg-text-primary text-surface-primary rounded-lg px-4 py-2 text-sm font-semibold"
    >
      Sign out and start again
    </button>
    <ContactLinks />
  </div>
);

export default TradeAccountNotice;
