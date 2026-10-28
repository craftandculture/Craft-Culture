'use client';

import PlatformErrorScreen from '@/app/(routes)/(platform)/PlatformErrorScreen';

/**
 * Error boundary for the Private Cellar
 *
 * Collector-facing: calm wording and nothing technical.
 */
const CellarError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  return (
    <PlatformErrorScreen
      error={error}
      reset={reset}
      title="We could not open this page"
      message="Your cellar is safe and nothing has changed. Please try again in a moment. If the page still does not open, our team will be glad to help."
    />
  );
};

export default CellarError;
