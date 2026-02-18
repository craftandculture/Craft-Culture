'use client';

import useBrandedTitle from '@/app/_ui/hooks/useBrandedTitle';

export interface BrandedTitleProviderProps {
  customerType: 'b2b' | 'b2c' | 'private_clients';
}

/**
 * Client component that sets the browser title based on customer type
 *
 * - B2C users see "Craft & Culture"
 * - B2B users see "C&C Index"
 *
 * @param props - The provider props
 */
const BrandedTitleProvider = ({ customerType }: BrandedTitleProviderProps) => {
  useBrandedTitle(customerType);
  return null;
};

export default BrandedTitleProvider;
