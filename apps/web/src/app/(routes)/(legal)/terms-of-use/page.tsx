import type { Metadata } from 'next';

import TermsOfUseDocument from '@/app/_legal/components/TermsOfUseDocument';

export const metadata: Metadata = {
  title: 'Terms of Use | Craft & Culture Index',
  description:
    'Terms of Use for the Craft & Culture Index wine and spirits platform',
};

/**
 * The Terms of Use outside the platform, readable before signing up
 *
 * The platform layout sends anyone without a completed profile to /welcome, so
 * the copy at /platform/terms-of-use cannot be read by the person being asked
 * to accept it. This is the same document on a route with no such guard.
 */
const TermsOfUsePage = () => <TermsOfUseDocument />;

export default TermsOfUsePage;
