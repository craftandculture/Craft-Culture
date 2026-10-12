import { Suspense } from 'react';

import ActivationReturn from '@/app/_onboarding/components/ActivationReturn';

/** Where Zoho's payment page sends a member back to */
const ActivatedPage = () => (
  <Suspense>
    <ActivationReturn />
  </Suspense>
);

export default ActivatedPage;
