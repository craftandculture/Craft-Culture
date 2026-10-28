'use client';

import * as Sentry from '@sentry/nextjs';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface PlatformErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  message: string;
  /** Show the error reference, for staff screens only */
  showReference?: boolean;
}

/**
 * Shared body of the platform error boundaries (error.tsx)
 *
 * A card with a Retry button that re-renders the failed segment and a link
 * to the support page.
 */
const PlatformErrorScreen = ({ error, reset, title, message, showReference }: PlatformErrorScreenProps) => {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border-muted bg-surface-primary p-6 text-center">
        <Icon icon={IconAlertCircle} size="lg" colorRole="muted" className="mx-auto" />
        <Typography variant="headingSm" className="mt-3">
          {title}
        </Typography>
        <Typography variant="bodySm" colorRole="muted" className="mt-2">
          {message}
        </Typography>
        {showReference && error.digest && (
          <Typography variant="bodyXs" colorRole="muted" className="mt-2 font-mono">
            Ref: {error.digest}
          </Typography>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90"
          >
            <IconRefresh className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/platform/support"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border-muted px-4 text-sm font-medium text-text-primary transition-colors hover:bg-fill-secondary"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PlatformErrorScreen;
