import scrubSentryEvent from './scrubSentryEvent';
import scrubSentryValue from './scrubSentryValue';

/**
 * The privacy settings every Sentry.init in the app spreads in
 *
 * Browser, server, edge and Trigger.dev each initialise Sentry separately.
 * Sharing one options object means a fifth runtime cannot be added with the
 * scrubbing forgotten, and the privacy policy's description of error
 * monitoring stays true of all of them.
 *
 * Session replay is deliberately absent: it is disabled pending a consent
 * decision, and the privacy policy says so.
 */
const sentryPrivacyOptions = {
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
  // Wrapped: Sentry passes a hint second, which would land in `depth`
  beforeBreadcrumb: <T>(breadcrumb: T) => scrubSentryValue(breadcrumb),
  beforeSendLog: <T>(log: T) => scrubSentryValue(log),
};

export default sentryPrivacyOptions;
