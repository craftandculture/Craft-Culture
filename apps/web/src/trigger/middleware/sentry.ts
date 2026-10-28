import * as Sentry from '@sentry/nextjs';
import { logger, tasks } from '@trigger.dev/sdk';
import { APICallError } from 'ai';

import sentryPrivacyOptions from '@/lib/sentry/sentryPrivacyOptions';
import tryCatch from '@/utils/tryCatch';

export const sentryOnFailure = tasks.onFailure(
  async ({ ctx, error, payload }) => {
    if (ctx.environment.type == 'DEVELOPMENT') {
      logger.log('Not recording exception: Sentry is disabled in development');
      return;
    }

    if (APICallError.isInstance(error)) {
      const cause = {
        name: error.name,
        message: error.message,
        url: error.url,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
      };
      Sentry.setContext('cause', { ...cause });
      logger.error('APICallError:', { cause });
    }

    /*
      Only the payload's field names: task payloads carry client names,
      emails and order contents, which do not belong in error reporting.
    */
    if (payload && typeof payload === 'object') {
      await tryCatch(async () => {
        Sentry.setContext('task_payload', { keys: Object.keys(payload) });
      });
    }

    Sentry.captureException(error);
    await Sentry.flush(); /** Probably not needed, but just in case */
  },
);

export const sentryMiddleware = tasks.middleware(
  'sentry',
  async ({ next, ctx }) => {
    if (ctx.environment.type == 'DEVELOPMENT') {
      return next();
    }

    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!sentryDsn) {
      return next();
    }

    Sentry.init({
      dsn: sentryDsn,
      ...sentryPrivacyOptions,
    });

    Sentry.setTags({
      trigger_run_id: ctx.run.id,
      trigger_task_id: ctx.task.id,
      trigger_attempt_number: ctx.attempt.number,
      machine: ctx.machine?.name,
      cpu: ctx.machine?.cpu,
      memory: ctx.machine?.memory,
    });

    await next();
  },
);
