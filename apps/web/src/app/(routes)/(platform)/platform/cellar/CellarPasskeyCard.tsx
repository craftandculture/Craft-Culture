'use client';

import { IconFaceId, IconX } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import authBrowserClient from '@/lib/better-auth/browser';
import features from '@/lib/features';
import { useTRPCClient } from '@/lib/trpc/browser';

const DISMISSED_KEY = 'cc-cellar-passkey-dismissed';
const INSTALL_DISMISSED_KEY = 'cc-cellar-install-dismissed';

const stored = (key: string) => {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export interface CellarPasskeyCardProps {
  /** Your cellar offers it once and lets it be dismissed; Your details always offers it */
  placement?: 'home' | 'details';
}

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Offer Face ID (a passkey) to a member on a phone, once
 *
 * An emailed link is a fine first sign-in and a poor daily one on a phone:
 * leave the app, find the email, come back. A passkey makes the next sign-in
 * Face ID, Touch ID or the phone's PIN.
 *
 * On Your cellar it waits its turn beneath the wine: shown only once the
 * home-screen card is out of the way (installed or dismissed), and until it is
 * dismissed. On Your details it is always offered. Either way, only where the
 * phone can hold a passkey and only while the account has none.
 */
const CellarPasskeyCard = ({ placement = 'home' }: CellarPasskeyCardProps) => {
  const queryClient = useQueryClient();
  const trpcClient = useTRPCClient();
  const [eligible, setEligible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!features.passkeys || !window.PublicKeyCredential) return;
      if (placement === 'home') {
        if (stored(DISMISSED_KEY)) return;
        if (!isInstalled() && !stored(INSTALL_DISMISSED_KEY)) return;
      }
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      try {
        setEligible(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
      } catch {
        setEligible(false);
      }
    };
    void check();
  }, [placement]);

  const { data: passkeys } = useQuery({
    queryKey: ['passkeys.list'],
    queryFn: () => trpcClient.passkeys.list.query(),
    enabled: eligible,
  });

  const dismiss = () => {
    setEligible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing: it simply shows again next visit
    }
  };

  const add = async () => {
    setIsAdding(true);
    try {
      const name = /iphone|ipad/i.test(navigator.userAgent) ? 'iPhone' : 'Phone';
      const response = await authBrowserClient.passkey.addPasskey({ name });
      if (!response || 'error' in response) {
        toast.error('Face ID could not be set up. You can try again from Your details.');
        return;
      }
      toast.success('Done. Next time, sign in with Face ID.');
      void queryClient.invalidateQueries({ queryKey: ['passkeys.list'] });
      dismiss();
    } catch {
      toast.error('Face ID could not be set up. You can try again from Your details.');
    } finally {
      setIsAdding(false);
    }
  };

  if (!eligible || !passkeys || passkeys.length > 0) return null;

  return (
    <div
      className={`border-border-muted relative flex gap-3 rounded-2xl border p-4 md:hidden ${placement === 'home' ? 'mt-5 pr-11' : ''}`}
    >
      <span className="bg-surface-muted text-text-muted grid size-10 shrink-0 place-items-center rounded-xl">
        <IconFaceId size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-primary text-sm font-semibold">Sign in with Face ID next time</p>
        <p className="text-text-muted text-[13px] leading-relaxed">
          Skip the email link on this phone. Face ID, Touch ID or your phone&apos;s PIN will open your cellar.
        </p>
        <button
          type="button"
          onClick={add}
          disabled={isAdding}
          className="self-start text-sm font-semibold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
        >
          {isAdding ? 'Setting up…' : 'Set up Face ID'}
        </button>
      </div>
      {placement === 'home' && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-text-muted absolute top-3 right-3 grid size-8 place-items-center rounded-full"
        >
          <IconX size={16} />
        </button>
      )}
    </div>
  );
};

export default CellarPasskeyCard;
