import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApproveApplication from './controller/adminApproveApplication';
import adminDeclineApplication from './controller/adminDeclineApplication';
import adminListApplications from './controller/adminListApplications';
import adminMergeApplication from './controller/adminMergeApplication';
import adminUpdateApplication from './controller/adminUpdateApplication';
import adminUploadApplicationIdentity from './controller/adminUploadApplicationIdentity';
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
  /** Kevin and Laraine's side: Cellar members → Applications */
  admin: createTRPCRouter({
    listApplications: adminListApplications,
    approveApplication: adminApproveApplication,
    declineApplication: adminDeclineApplication,
    updateApplication: adminUpdateApplication,
    uploadApplicationIdentity: adminUploadApplicationIdentity,
    mergeApplication: adminMergeApplication,
  }),
});

export default onboardingRouter;
