'use client';

import useCookieConsent from '@/app/_cookies/hooks/useCookieConsent';
import Link from '@/app/_ui/components/Link/Link';
import LinkContent from '@/app/_ui/components/Link/LinkContent';

const CookieSettingsButton = () => {
  const { showCookieDialog } = useCookieConsent();
  return (
    <Link
      colorRole="muted"
      variant="bodySm"
      href="javascript:;"
      onClick={() => showCookieDialog()}
    >
      <LinkContent>Cookie settings</LinkContent>
    </Link>
  );
};

export default CookieSettingsButton;
