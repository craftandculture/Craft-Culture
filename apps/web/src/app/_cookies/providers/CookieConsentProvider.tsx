'use client';

import { deleteCookie, setCookie } from 'cookies-next';
import { useAtom } from 'jotai/react';
import { atomWithStorage } from 'jotai/utils';
import { usePathname } from 'next/navigation';
import { createContext, useEffect, useMemo, useState } from 'react';

import CookieConsentDialog from '../components/CookieConsentDialog';
import getConsentFromCookie, {
  CookieConsent,
} from '../utils/getConsentFromCookie';

export interface CookieConsentContextType extends CookieConsent {
  setConsent: (consent: CookieConsent) => void;
  showCookieDialog: () => void;
  hideCookieDialog: () => void;
}

export const CookieConsentContext =
  createContext<CookieConsentContextType | null>(null);

export interface CookieConsentProviderProps {
  cookieName?: string;
  expirationTimeSeconds?: number;
  allowList?: string[];
}

const CookieConsentProvider = ({
  cookieName = 'cookie-consent',
  expirationTimeSeconds = 365 * 24 * 60 * 60,
  allowList = [],
  children,
}: React.PropsWithChildren<CookieConsentProviderProps>) => {
  const pathname = usePathname();
  const [cookieDialogOpen, setCookieDialogOpen] = useState(false);

  const atom = useMemo(
    () =>
      atomWithStorage<CookieConsent | null>(cookieName, null, {
        setItem(key, newValue) {
          void setCookie(key, JSON.stringify(newValue), {
            expires: new Date(Date.now() + expirationTimeSeconds * 1000),
          });
        },
        getItem(key) {
          return getConsentFromCookie(key);
        },
        removeItem(key) {
          void deleteCookie(key);
        },
      }),
    [cookieName, expirationTimeSeconds],
  );

  const [consent, setConsent] = useAtom(atom);

  const showCookieDialog = () => {
    setCookieDialogOpen(true);
  };

  const hideCookieDialog = () => {
    setCookieDialogOpen(false);
  };

  useEffect(() => {
    if (consent?.consented === false && !allowList.includes(pathname)) {
      showCookieDialog();
    }
  }, [allowList, consent, pathname]);

  return (
    <CookieConsentContext.Provider
      value={{
        consented: consent?.consented ?? false,
        marketing: consent?.marketing ?? false,
        analytics: consent?.analytics ?? false,
        preferences: consent?.preferences ?? false,
        setConsent,
        showCookieDialog,
        hideCookieDialog,
      }}
    >
      <CookieConsentDialog
        open={cookieDialogOpen}
        onOpenChange={setCookieDialogOpen}
      />
      {children}
    </CookieConsentContext.Provider>
  );
};

export default CookieConsentProvider;
