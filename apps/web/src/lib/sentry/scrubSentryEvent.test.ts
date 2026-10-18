import { describe, expect, it } from 'vitest';

import scrubSentryEvent from './scrubSentryEvent';
import scrubSentryString from './scrubSentryString';
import scrubSentryValue from './scrubSentryValue';
import sentryPrivacyOptions from './sentryPrivacyOptions';

describe('scrubSentryString', () => {
  it('filters the magic-link token', () => {
    expect(
      scrubSentryString('https://wine.craftculture.xyz/auth/verify?token=abc123&callbackURL=/platform'),
    ).toBe('https://wine.craftculture.xyz/auth/verify?token=[Filtered]&callbackURL=[Filtered]');
  });

  it('filters the cellar invite code', () => {
    expect(scrubSentryString('/join?invite=bJ_7ZE2_O4RE9D6')).toBe('/join?invite=[Filtered]');
  });

  it('filters tRPC GET input, which carries the whole query', () => {
    expect(
      scrubSentryString('/api/trpc/partners.list?batch=1&input=%7B%22search%22%3A%22Smith%22%7D'),
    ).toBe('/api/trpc/partners.list?batch=[Filtered]&input=[Filtered]');
  });

  it('filters values carried in a fragment', () => {
    expect(scrubSentryString('/cb#access_token=xyz')).toBe('/cb#access_token=[Filtered]');
  });

  it('masks client quote slugs', () => {
    expect(scrubSentryString('GET /q/k3j9-secret-slug?x=1')).toBe('GET /q/[slug]?x=[Filtered]');
  });

  it('removes emails, Emirates ID numbers, bearer tokens and embedded files', () => {
    expect(
      scrubSentryString(
        'user jane.doe@example.com id 784-1985-1234567-1 Bearer eyJhbGci.payload file data:image/png;base64,iVBORw0KGgo=',
      ),
    ).toBe('user [email] id [id number] Bearer [Filtered] file [file removed]');
  });

  it('leaves an ordinary path alone', () => {
    expect(scrubSentryString('/platform/admin/wms/stock')).toBe('/platform/admin/wms/stock');
  });
});

describe('scrubSentryValue', () => {
  it('withholds sensitive keys and scrubs nested strings', () => {
    expect(
      scrubSentryValue({
        password: 'hunter2',
        nested: { identityDocument: 'anything', url: '/join?invite=x' },
        list: ['/auth/verify?token=t'],
        count: 3,
      }),
    ).toEqual({
      password: '[Filtered]',
      nested: { identityDocument: '[Filtered]', url: '/join?invite=[Filtered]' },
      list: ['/auth/verify?token=[Filtered]'],
      count: 3,
    });
  });
});

describe('scrubSentryEvent', () => {
  it('drops bodies and cookies, trims headers and reduces the user to an id', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://wine.craftculture.xyz/join?invite=abc',
        query_string: 'invite=abc',
        cookies: { session: 's' },
        data: '{"file":"data:image/png;base64,AAAA"}',
        headers: { cookie: 'session=s', authorization: 'Bearer t', 'user-agent': 'UA' },
      },
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
      breadcrumbs: [{ category: 'navigation', data: { to: '/auth/verify?token=t' } }],
    });

    expect(event.request).toEqual({
      url: 'https://wine.craftculture.xyz/join?invite=[Filtered]',
      query_string: '[Filtered]',
      headers: { 'user-agent': 'UA' },
    });
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.breadcrumbs).toEqual([
      { category: 'navigation', data: { to: '/auth/verify?token=[Filtered]' } },
    ]);
  });

  it('scrubs span descriptions and data in transactions', () => {
    const event = scrubSentryEvent({
      request: {},
      transaction: 'GET /q/[slug]',
      spans: [{ description: 'GET https://x.test/join?invite=abc', data: { 'url.full': '/a?token=t' } }],
    });

    expect(event.spans).toEqual([
      { description: 'GET https://x.test/join?invite=[Filtered]', data: { 'url.full': '/a?token=[Filtered]' } },
    ]);
  });
});

describe('sentryPrivacyOptions', () => {
  it('ignores the hint Sentry passes to beforeBreadcrumb', () => {
    const crumb = sentryPrivacyOptions.beforeBreadcrumb({
      category: 'fetch',
      data: { url: '/auth/verify?token=t' },
    });

    expect(crumb).toEqual({ category: 'fetch', data: { url: '/auth/verify?token=[Filtered]' } });
  });
});
