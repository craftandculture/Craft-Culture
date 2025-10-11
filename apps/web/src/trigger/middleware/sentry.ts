import * as Sentry from '@sentry/nextjs';
import { logger, tasks } from '@trigger.dev/sdk';
import { APICallError } from 'ai';

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
        responseHeaders: error.responseHeaders,
        responseBody: error.responseBody,
        isRetryable: error.isRetryable,
        data: error.data,
      };
      Sentry.setContext('cause', { ...cause });
      logger.error('APICallError:', { cause });
    }

    if (payload) {
      await tryCatch(async () => {
        Sentry.setContext('task_payload', { data: JSON.stringify(payload) });
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
      throw new Error('NEXT_PUBLIC_SENTRY_DSN is not set');
    }

    Sentry.init({
      dsn: sentryDsn,
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
