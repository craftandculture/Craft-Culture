import { PropsWithChildren } from 'react';

import Logo from '@/app/_ui/components/Logo/Logo';

const OFFERS = ['Stock, pricing and availability', 'Orders, deliveries and documents', 'Your cellar, held in bond'];

/**
 * Sign-in, verify and welcome, framed by a brand panel on wide screens
 *
 * The panel says what Index is before anyone has an account; on a phone it is
 * dropped and the logo sits above the form instead, so the form is never
 * pushed below the fold.
 */
const AuthLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex min-h-screen">
      <aside className="hidden w-[40%] max-w-xl shrink-0 flex-col justify-between bg-neutral-950 bg-[radial-gradient(120%_80%_at_0%_100%,#161a19,#0a0a0a)] p-10 text-neutral-50 lg:flex">
        <Logo className="-ml-3 -mt-4 h-30 w-auto self-start invert" />
        <div className="flex flex-col gap-5">
          <h2 className="max-w-[16ch] text-3xl font-semibold leading-tight tracking-tight text-balance">
            Your fine-wine account with Craft &amp; Culture.
          </h2>
          <ul className="flex flex-col gap-2.5 text-sm text-neutral-400">
            {OFFERS.map((offer) => (
              <li key={offer} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-neutral-400" />
                {offer}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-500">Craft and Culture FZE · craftculture.xyz</p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="lg:hidden">
            <Logo className="h-24 w-auto" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
