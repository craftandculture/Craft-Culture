// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import sentryPrivacyOptions from '@/lib/sentry/sentryPrivacyOptions';

Sentry.init({
  /*
    Unset means Sentry is off. Events must only go to a Sentry org that
    Craft & Culture owns, so the DSN comes from the environment.
  */
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  /*
    Session replay is disabled pending a consent decision, and the privacy
    policy says so. Do not re-add replayIntegration without updating both.
  */
  ...sentryPrivacyOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
