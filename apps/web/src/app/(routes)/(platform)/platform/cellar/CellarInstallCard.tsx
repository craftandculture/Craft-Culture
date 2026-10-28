'use client';

import { IconDeviceMobile, IconShare2, IconSquarePlus, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'cc-cellar-install-dismissed';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface CellarInstallCardProps {
  /** Your cellar offers it once and lets it be dismissed; Your details always offers it */
  placement?: 'home' | 'details';
}

const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * A suggestion to keep the cellar on the home screen
 *
 * On Your cellar it sits beneath the wine, on a phone, until it is installed
 * or dismissed. On Your details it stays, without a close button, for as long
 * as the cellar is not installed. iPhone has no install prompt a page can
 * raise, so it is told the two taps in Safari; Android and desktop Chrome
 * offer their own, which the link opens. Nothing shows once the cellar is
 * opened from the home screen.
 */
const CellarInstallCard = ({ placement = 'home' }: CellarInstallCardProps) => {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalled()) return;
    if (placement === 'home' && readDismissed()) return;
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [placement]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing: it simply shows again next visit
    }
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setPrompt(null);
  };

  if (!visible) return null;
  if (!isIos && !prompt) return null;

  return (
    <div
      className={`border-border-muted relative flex gap-3 rounded-2xl border p-4 md:hidden ${placement === 'home' ? 'mt-5 pr-11' : ''}`}
    >
      <span className="bg-surface-muted text-text-muted grid size-10 shrink-0 place-items-center rounded-xl">
        <IconDeviceMobile size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-primary text-sm font-semibold">Keep your cellar on your home screen</p>
        {isIos ? (
          <p className="text-text-muted text-[13px] leading-relaxed">
            In Safari, tap <IconShare2 size={15} className="inline -translate-y-px" aria-label="Share" /> Share, then{' '}
            <IconSquarePlus size={15} className="inline -translate-y-px" aria-hidden /> <b>Add to Home Screen</b>. It
            then opens like an app.
          </p>
        ) : (
          <>
            <p className="text-text-muted text-[13px] leading-relaxed">It then opens like an app, straight into your cellar.</p>
            <button
              type="button"
              onClick={install}
              className="self-start text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Add to home screen
            </button>
          </>
        )}
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

export default CellarInstallCard;
