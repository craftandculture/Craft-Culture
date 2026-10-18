import type { Metadata } from 'next';

import PrivacyPolicyDocument from '@/app/_legal/components/PrivacyPolicyDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy | Craft & Culture',
  description:
    'How Craft & Culture FZE collects, uses, shares and protects personal data across its Services',
};

/**
 * The Privacy Policy, readable without an account
 */
const PrivacyPage = () => <PrivacyPolicyDocument />;

export default PrivacyPage;
