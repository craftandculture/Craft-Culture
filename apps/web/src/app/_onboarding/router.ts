import { createTRPCRouter } from '@/lib/trpc/trpc';

import claimInvite from './controller/claimInvite';
import getMyApplication from './controller/getMyApplication';
import saveApplicationStep from './controller/saveApplicationStep';
import submitApplication from './controller/submitApplication';
import uploadApplicationIdentity from './controller/uploadApplicationIdentity';

const onboardingRouter = createTRPCRouter({
  /** The signed-in person's own application */
  application: createTRPCRouter({
    get: getMyApplication,
    saveStep: saveApplicationStep,
    uploadIdentity: uploadApplicationIdentity,
    submit: submitApplication,
    claimInvite,
  }),
});

export default onboardingRouter;
