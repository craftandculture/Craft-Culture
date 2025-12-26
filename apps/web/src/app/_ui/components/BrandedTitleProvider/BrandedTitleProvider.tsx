'use client';

import useBrandedTitle from '@/app/_ui/hooks/useBrandedTitle';

export interface BrandedTitleProviderProps {
  customerType: 'b2b' | 'b2c';
}

/**
 * Client component that sets the browser title based on customer type
 *
 * - B2C users see "Pocket Cellar"
 * - B2B users see "C&C Index"
 *
 * @param props - The provider props
 * @returns null (side-effect only component)
 */
const BrandedTitleProvider = ({ customerType }: BrandedTitleProviderProps) => {
  useBrandedTitle(customerType);
  return null;
};

export default BrandedTitleProvider;
