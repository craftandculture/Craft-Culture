import type { ProductUpdateAudience } from '../types';

/**
 * The screens an update may point a member to, and what its button says
 *
 * The AI may only choose from these, so a member is never sent to a page that
 * does not exist or is not theirs. Trade partner links join with the partner
 * portal's What's New.
 */
const memberLinks: Record<ProductUpdateAudience, { path: string; label: string; about: string }[]> = {
  collector: [
    { path: '/platform/cellar', label: 'View your cellar', about: 'the collection: wines held, valuations, drinking windows' },
    { path: '/platform/cellar/deliveries', label: 'View your deliveries', about: 'requesting a delivery and following it' },
    { path: '/platform/cellar/selling', label: 'View your sales', about: 'offering wine for sale and sale proceeds' },
    { path: '/platform/cellar/available', label: 'View the Cellar List', about: 'wine available to add to the cellar' },
    { path: '/platform/cellar/statement', label: 'View your statements', about: 'monthly statements' },
    { path: '/platform/cellar/invoices', label: 'View your invoices', about: 'invoices' },
    { path: '/platform/cellar/purchases', label: 'View your purchases', about: 'wine bought into the cellar' },
    { path: '/platform/cellar/activity', label: 'View your activity', about: 'the full record of arrivals, deliveries and sales' },
    { path: '/platform/cellar/profile', label: 'View your details', about: 'contact details, shared access, sign-in' },
  ],
  wine_partner: [],
};

export default memberLinks;
