import type { inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/trpc-router';

export type QuoteDraft = inferRouterOutputs<AppRouter>['logistics']['admin']['quotes']['extract'];

export interface PendingQuoteDraft {
  requestId: string;
  draft: QuoteDraft;
  /** The forwarder's document, kept with the quote once it is saved */
  file: { base64: string; fileName: string; mimeType: string } | null;
}

let pending: PendingQuoteDraft | null = null;

/**
 * Hand a quote read from a forwarder's document to the quote form
 *
 * Held in memory across the in-app navigation from the request page to the
 * form, because the document can be larger than browser storage allows. A
 * reload loses it, and the form simply opens empty. Calling with no argument
 * takes the draft and clears it, so it fills one form only.
 *
 * @example
 *   pendingQuoteDraft({ requestId, draft, file }); // store
 *   const taken = pendingQuoteDraft(); // take, for this request
 *
 * @param next - The draft to hold; omit to take the one held
 * @returns The draft taken, or null
 */
const pendingQuoteDraft = (next?: PendingQuoteDraft) => {
  if (next) {
    pending = next;
    return null;
  }

  const taken = pending;
  pending = null;

  return taken;
};

export default pendingQuoteDraft;
