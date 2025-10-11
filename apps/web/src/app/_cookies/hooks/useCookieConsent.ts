import { useContext } from 'react';

import { CookieConsentContext } from '../providers/CookieConsentProvider';

const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error(
      'useCookieConsent must be used within a CookieConsentProvider',
    );
  }

  return context;
};

export default useCookieConsent;
