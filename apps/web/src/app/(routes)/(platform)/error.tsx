'use client';

import PlatformErrorScreen from './PlatformErrorScreen';

/**
 * Error boundary for the platform
 */
const PlatformError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  return (
    <PlatformErrorScreen
      error={error}
      reset={reset}
      title="Something went wrong"
      message="This page could not be loaded. Please try again, or contact support if it keeps happening."
    />
  );
};

export default PlatformError;
