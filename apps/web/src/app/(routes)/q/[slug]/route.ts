import { eq } from 'drizzle-orm';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import renderQuote from '@/app/_salesQuotes/template/renderQuote';
import db from '@/database/client';
import { salesQuotes } from '@/database/schema';
import tryCatch from '@/utils/tryCatch';

/**
 * Public, unauthenticated client-facing quote page: /q/<slug>
 *
 * Served as a route handler rather than a page because the standard template is
 * a complete HTML document — a page would nest it inside the app's layouts.
 *
 * Only `published` quotes are public. A draft or archived quote still renders,
 * but only for a signed-in admin, so the team can proof a quote before the link
 * goes out without exposing it to anyone who guesses the slug.
 *
 * Nothing here is gated by middleware, which only guards /platform and
 * /welcome — that is what makes the link shareable with a client who has no
 * login.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;

  const [rows, error] = await tryCatch(
    db
      .select()
      .from(salesQuotes)
      .where(eq(salesQuotes.slug, slug))
      .limit(1),
  );

  if (error) {
    console.error('Error loading sales quote', { error, slug });
    return new Response('Unable to load this quotation.', { status: 500 });
  }

  const quote = rows?.[0];
  const notFound = () =>
    new Response('Quotation not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });

  if (!quote) return notFound();

  const isPublished = quote.status === 'published';

  if (!isPublished) {
    const [user] = await tryCatch(getCurrentUser());

    // deliberately a 404 rather than a 403: an unpublished slug should look
    // like it does not exist
    if (user?.role !== 'admin') return notFound();
  }

  const html = renderQuote({
    slug: quote.slug,
    quoteRef: quote.quoteRef,
    client: quote.client,
    eyebrow: quote.eyebrow,
    h1: quote.h1,
    subtitle: quote.subtitle,
    lines: quote.lines,
    options: quote.options,
    validUntil: quote.validUntil,
    promoUntil: quote.promoUntil,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // prices are snapshotted onto the quote, so a short edge cache is safe for
      // a published link; drafts are per-admin and must never be cached
      'cache-control': isPublished
        ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
        : 'private, no-store',
      // the template already carries a noindex meta tag; belt and braces
      'x-robots-tag': 'noindex, nofollow',
    },
  });
};
