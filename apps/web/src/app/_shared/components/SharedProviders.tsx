import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import CookieConsentProvider from '@/app/_cookies/providers/CookieConsentProvider';
import TRPCReactProvider from '@/app/_shared/components/TRPCReactProvider';
import Toaster from '@/app/_ui/components/Toaster/Toaster';
import TooltipProvider from '@/app/_ui/components/Tooltip/TooltipProvider';

export interface SharedProvidersProps {
  forcedTheme?: 'light' | 'dark';
}

const SharedProviders = async ({
  children,
  forcedTheme,
}: React.PropsWithChildren<SharedProvidersProps>) => {
  return (
    <>
      <ThemeProvider
        enableSystem={true}
        storageKey="craft-culture.theme"
        defaultTheme="light"
        forcedTheme={forcedTheme}
      >
        <CookieConsentProvider cookieName="craft-culture.cookie_consent">
          <TooltipProvider>
            <TRPCReactProvider>
              <NuqsAdapter>
                {children}
                <ReactQueryDevtools
                  initialIsOpen={false}
                  buttonPosition="bottom-right"
                />
                <Toaster />
              </NuqsAdapter>
            </TRPCReactProvider>
          </TooltipProvider>
        </CookieConsentProvider>
      </ThemeProvider>
    </>
  );
};

export default SharedProviders;
