import { createHash } from 'crypto';

import { UserLifecycleStage } from '../data/getUserLifecycleStage';

export interface GetUserHashParams {
  lifecycleStage: UserLifecycleStage;
  organizationCount: number;
  administrationCount: number;
  email: string;
  lastTrialEndsAt?: Date;
  lastActiveAt?: Date | null;
}

const getUserHash = ({
  lifecycleStage,
  organizationCount,
  administrationCount,
  email,
  lastTrialEndsAt,
  lastActiveAt,
}: GetUserHashParams) => {
  return createHash('sha256')
    .update(
      JSON.stringify({
        lifecycleStage,
        organizationCount,
        administrationCount,
        email,
        lastTrialEndsAt,
        lastActiveAt,
      }),
    )
    .digest('hex');
};

export default getUserHash;
