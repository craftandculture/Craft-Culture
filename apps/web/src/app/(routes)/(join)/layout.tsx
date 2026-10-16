import Image from 'next/image';
import Link from 'next/link';
import type { PropsWithChildren } from 'react';


import wordmark from '@/app/_onboarding/assets/wordmark.png';
import { PRIVATE_CELLAR_TERMS_PATH } from '@/app/_onboarding/constants/privateCellarTerms';

/**
 * The frame around Private Cellar sign-up
 *
 * Kept apart from the platform layout so its approval and onboarding redirects
 * never fire while someone is still applying, and apart from the plain auth
 * layout so the journey can have room and a voice of its own.
 */
const JoinLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/40 via-transparent to-transparent dark:from-emerald-500/5">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-5">
        {/* The shared logo is a square with the mark in its middle third; this is the mark alone */}
        <Image src={wordmark} alt="Craft & Culture Index" priority className="h-12 w-auto sm:h-14 dark:invert" />
        <span className="bg-border-muted h-8 w-px" />
        <span className="text-text-muted text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm">
          Private Cellar
        </span>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-6 sm:pt-10">{children}</main>
      {/*
        An onboarding page, so the only ways out are legal and help: no site
        navigation, social links or rate cards to pull someone away mid-way.
      */}
      <footer className="mx-auto w-full max-w-5xl px-5 pb-10">
        <div className="border-border-muted border-t pt-6 text-center sm:text-left">
          <p className="text-text-primary text-sm font-medium">
            Your collection. Professionally stored. Privately managed.
          </p>
          <div className="text-text-muted mt-3 flex flex-col gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <span>Craft &amp; Culture FZE &middot; UAE</span>
            <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-end">
              <Link href={PRIVATE_CELLAR_TERMS_PATH} target="_blank" className="hover:text-text-primary underline-offset-2 hover:underline">
                Private Cellar Terms
              </Link>
              <span aria-hidden>&middot;</span>
              <Link href="/privacy" target="_blank" className="hover:text-text-primary underline-offset-2 hover:underline">
                Privacy
              </Link>
              <span aria-hidden>&middot;</span>
              <a href="mailto:info@craftculture.xyz" className="hover:text-text-primary underline-offset-2 hover:underline">
                Contact
              </a>
            </nav>
          </div>
          <p className="text-text-muted/80 mt-3 text-[11px]">&copy; {new Date().getFullYear()} Craft &amp; Culture FZE</p>
        </div>
      </footer>
    </div>
  );
};

export default JoinLayout;
