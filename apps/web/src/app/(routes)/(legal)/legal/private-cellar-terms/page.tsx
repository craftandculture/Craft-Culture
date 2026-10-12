import type { Metadata } from 'next';

import PrivateCellarTermsDocument from '@/app/_legal/components/PrivateCellarTermsDocument';
import getMembershipTerms from '@/app/_onboarding/data/getMembershipTerms';

export const metadata: Metadata = {
  title: 'Private Cellar Membership Terms | Craft & Culture',
};

// Figures are read from the rate card, so never served stale
export const dynamic = 'force-dynamic';

/** The Private Cellar terms, public so they can be read before joining */
const PrivateCellarTermsPage = async () => {
  const terms = await getMembershipTerms();

  return <PrivateCellarTermsDocument {...terms} />;
};

export default PrivateCellarTermsPage;
