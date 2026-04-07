'use client';

import { IconLoader2, IconMailX } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Magic link verification landing page.
 *
 * Email clients often prefetch links for security scanning, which consumes
 * magic link tokens before the user clicks. This page acts as a buffer:
 * email scanners fetch this HTML page (harmless), and only the user's
 * browser executes the JS redirect to the actual verify endpoint.
 */
const VerifyContent = () => {
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError(true);
      return;
    }

    // Rebuild the verify URL with all original params
    const verifyUrl = new URL('/api/auth/magic-link/verify', window.location.origin);
    searchParams.forEach((value, key) => {
      verifyUrl.searchParams.set(key, value);
    });

    // Navigate to the actual Better Auth verify endpoint
    // This only runs in a real browser (not email client prefetch)
    window.location.replace(verifyUrl.toString());
  }, [searchParams]);

  if (error) {
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

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Icon icon={IconLoader2} size="xl" colorRole="brand" className="animate-spin" />
      <Typography variant="headingMd" className="text-center">
        Signing you in...
      </Typography>
      <Typography variant="bodySm" colorRole="muted" className="text-center">
        Please wait while we verify your login link.
      </Typography>
    </div>
  );
};

const VerifyPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex w-full flex-col items-center gap-4">
          <Icon icon={IconLoader2} size="xl" colorRole="brand" className="animate-spin" />
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
