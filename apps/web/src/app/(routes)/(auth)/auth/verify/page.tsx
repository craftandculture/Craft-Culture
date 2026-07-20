'use client';

import { IconMail, IconMailX } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Magic link verification landing page.
 *
 * Corporate email security (e.g. Microsoft Defender / Safe Links "detonation")
 * opens links in a headless browser that renders and even runs JavaScript,
 * which would consume a one-time magic-link token before the real user clicks.
 *
 * To defeat that, this page does NOT auto-redirect — it requires a genuine
 * button click. Automated scanners render the page but don't click buttons, so
 * the token is only spent by the human's browser.
 */
const VerifyContent = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <Icon icon={IconMailX} size="xl" colorRole="danger" />
        <Typography variant="headingMd" className="text-center">
          Invalid login link
        </Typography>
        <Typography variant="bodySm" colorRole="muted" className="text-center">
          This link is invalid or has expired. Please request a new one.
        </Typography>
        <Button variant="default" colorRole="brand" asChild>
          <a href="/sign-in">Back to sign in</a>
        </Button>
      </div>
    );
  }

  // Same-origin verify endpoint with all original params preserved.
  const verifyHref = `/api/auth/magic-link/verify?${searchParams.toString()}`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Icon icon={IconMail} size="xl" colorRole="brand" />
      <Typography variant="headingMd" className="text-center">
        Confirm sign-in
      </Typography>
      <Typography variant="bodySm" colorRole="muted" className="text-center">
        Click below to finish signing in. This extra step stops automated email
        scanners from using up your one-time link.
      </Typography>
      <Button
        variant="default"
        colorRole="brand"
        onClick={() => {
          window.location.replace(verifyHref);
        }}
      >
        Sign in to Craft &amp; Culture
      </Button>
    </div>
  );
};

const VerifyPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex w-full flex-col items-center gap-4">
          <Typography variant="headingMd" className="text-center">
            Loading...
          </Typography>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
};

export default VerifyPage;
