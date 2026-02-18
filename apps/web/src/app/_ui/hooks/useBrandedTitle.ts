'use client';

import { useEffect } from 'react';

/**
 * Updates the document title based on customer type
 *
 * - B2C users see "Craft & Culture"
 * - B2B and private_clients users see "C&C Index"
 *
 * @param customerType - The user's customer type
 */
const useBrandedTitle = (customerType: 'b2b' | 'b2c' | 'private_clients') => {
  useEffect(() => {
    document.title = customerType === 'b2c' ? 'Craft & Culture' : 'C&C Index';
  }, [customerType]);
};

export default useBrandedTitle;
