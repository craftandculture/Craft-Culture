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
    <div className="bg-background-muted min-h-screen">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-5 pt-6">
        <Logo className="h-9 w-auto" />
        <span className="bg-border-muted h-5 w-px" />
        <span className="text-text-muted text-xs font-semibold uppercase tracking-[0.18em]">
          Private Cellar
        </span>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pb-16 pt-8">{children}</main>
    </div>
  );
};

export default JoinLayout;
