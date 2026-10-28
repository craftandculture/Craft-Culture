'use client';

import PlatformErrorScreen from '@/app/(routes)/(platform)/PlatformErrorScreen';

/**
 * Error boundary for admin screens; staff see the error reference for Sentry
 */
const AdminError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  return (
    <PlatformErrorScreen
      error={error}
      reset={reset}
      title="This screen failed to load"
      message={error.message || 'An unexpected error occurred. Retry, or report it with the reference below.'}
      showReference
    />
  );
};

export default AdminError;
