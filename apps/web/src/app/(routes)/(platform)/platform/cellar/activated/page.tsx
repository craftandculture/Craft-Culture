import { Suspense } from 'react';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import ActivationReturn from '@/app/_onboarding/components/ActivationReturn';

/** Where Zoho's payment page sends a member back to, under the same heading as every cellar page */
const ActivatedPage = () => (
  <div className="w-full pb-8">
    <CellarPageHeader title="Your membership" />
    <Suspense>
      <ActivationReturn />
    </Suspense>
  </div>
);

export default ActivatedPage;
