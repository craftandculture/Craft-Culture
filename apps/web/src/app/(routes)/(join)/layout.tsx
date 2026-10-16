import type { PropsWithChildren } from 'react';

import Logo from '@/app/_ui/components/Logo/Logo';

/**
 * The frame around Private Cellar sign-up
 *
 * Kept apart from the platform layout so its approval and onboarding redirects
 * never fire while someone is still applying, and apart from the plain auth
 * layout so the journey can have room and a voice of its own.
 */
const JoinLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted min-h-screen bg-gradient-to-b from-emerald-50/40 via-transparent to-transparent dark:from-emerald-500/5">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-5">
        {/* The image carries its own margin, so it is drawn larger and pulled in */}
        <Logo className="-my-3 -ml-2 h-24 w-auto" />
        <span className="bg-border-muted h-5 w-px" />
        <span className="text-text-muted text-xs font-semibold uppercase tracking-[0.18em]">
          Private Cellar
        </span>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 pb-16 pt-6 sm:pt-10">{children}</main>
    </div>
  );
};

export default JoinLayout;
