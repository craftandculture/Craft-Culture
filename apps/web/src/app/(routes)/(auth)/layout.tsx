import { IconTemperature } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { PropsWithChildren } from 'react';

import Logo from '@/app/_ui/components/Logo/Logo';
import logoOnDark from '@/app/_ui/components/Logo/logo-on-dark.png';

/* Neutral on purpose: collectors and trade partners sign in through the same door */
const OFFERS = ['Your wine, held in bond', 'Orders, deliveries and documents', 'Availability across our cellars'];

/**
 * Sign-in, verify and welcome, framed by a brand panel on wide screens
 *
 * The panel says what Craft & Culture is before anyone has an account, over a photo of
 * our own cold room; on a phone it is dropped and the logo sits above the form
 * instead, so the form is never pushed below the fold.
 */
const AuthLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex min-h-screen">
      <aside className="relative hidden w-[42%] max-w-2xl shrink-0 overflow-hidden bg-neutral-950 text-neutral-50 lg:block">
        <Image src="/images/sign-in-cellar.jpg" alt="" fill sizes="42vw" className="object-cover opacity-60" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
        <div className="relative flex h-full min-h-screen flex-col justify-between p-12">
          <Image src={logoOnDark} alt="Craft & Culture Index" className="h-16 w-auto self-start" priority />
          <div className="flex flex-col gap-6">
            <h2 className="max-w-[14ch] text-4xl font-semibold leading-[1.1] tracking-tight text-balance">
              Your fine-wine account with Craft &amp; Culture.
            </h2>
            <ul className="flex flex-col gap-3 text-base text-neutral-300">
              {OFFERS.map((offer) => (
                <li key={offer} className="flex items-center gap-3">
                  <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" />
                  {offer}
                </li>
              ))}
            </ul>
            <p className="inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-neutral-100 ring-1 ring-white/15 backdrop-blur-sm">
              <IconTemperature size={16} />
              Temperature-controlled bonded storage, 12–16°C
            </p>
          </div>
          <p className="text-xs text-neutral-400">Craft &amp; Culture · craftculture.xyz</p>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col px-4 py-10 sm:px-8">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col items-center gap-8">
            <div className="lg:hidden">
              <Logo className="h-24 w-auto" />
            </div>
            {children}
          </div>
        </div>
        <nav className="text-text-muted mt-10 flex justify-center gap-5 text-xs">
          <Link href="/privacy" className="hover:text-text-primary">
            Privacy
          </Link>
          <Link href="/terms-of-use" className="hover:text-text-primary">
            Terms of use
          </Link>
          <span>© {new Date().getFullYear()} Craft &amp; Culture</span>
        </nav>
      </main>
    </div>
  );
};

export default AuthLayout;
