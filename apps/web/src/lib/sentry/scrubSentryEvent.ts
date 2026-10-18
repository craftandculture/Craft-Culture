import scrubSentryValue from './scrubSentryValue';

/** Request headers worth keeping for diagnosis; everything else is dropped */
const KEPT_HEADERS = new Set([
  'accept',
  'content-type',
  'host',
  'referer',
  'user-agent',
]);

interface ScrubbableEvent {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
  };
  user?: { id?: string | number } & Record<string, unknown>;
}

/**
 * Clean an error or transaction event before it is sent to Sentry
 *
 * Request bodies and cookies are removed outright (a body can be an identity
 * upload or a sign-in), headers are cut to a short allow-list, the user is
 * reduced to an id, and every remaining string is scrubbed.
 *
 * @example
 *   Sentry.init({ beforeSend: scrubSentryEvent });
 *
 * @param event - The event Sentry is about to send
 * @returns The cleaned event
 */
const scrubSentryEvent = <T extends ScrubbableEvent>(event: T) => {
  const copy = { ...event };

  if (copy.request) {
    const { cookies: _cookies, data: _data, ...request } = copy.request;

    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([name]) =>
          KEPT_HEADERS.has(name.toLowerCase()),
        ),
      );
    }

    if (request.query_string !== undefined) {
      request.query_string = '[Filtered]';
    }

    copy.request = request;
  }

  if (copy.user) {
    copy.user = copy.user.id === undefined ? {} : { id: copy.user.id };
  }

  return scrubSentryValue(copy);
};

export default scrubSentryEvent;
