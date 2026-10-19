import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddIntake from './controller/adminAddIntake';
import adminApproveApplication from './controller/adminApproveApplication';
import adminDeclineApplication from './controller/adminDeclineApplication';
import adminGetStorage from './controller/adminGetStorage';
import adminInviteMember from './controller/adminInviteMember';
import adminLinkIntakeShipment from './controller/adminLinkIntakeShipment';
import adminListApplications from './controller/adminListApplications';
import adminListIntakes from './controller/adminListIntakes';
import adminListInvites from './controller/adminListInvites';
import adminListLinkableShipments from './controller/adminListLinkableShipments';
import adminMergeApplication from './controller/adminMergeApplication';
import adminPushExtraCases from './controller/adminPushExtraCases';
import adminResendInvite from './controller/adminResendInvite';
import adminRevokeInvite from './controller/adminRevokeInvite';
import adminSetIntakeStage from './controller/adminSetIntakeStage';
import adminSetMembershipStatus from './controller/adminSetMembershipStatus';
import adminUpdateApplication from './controller/adminUpdateApplication';
import adminUploadApplicationIdentity from './controller/adminUploadApplicationIdentity';
import claimInvite from './controller/claimInvite';
import getMyApplication from './controller/getMyApplication';
import memberAddIntake from './controller/memberAddIntake';
import memberCompleteActivation from './controller/memberCompleteActivation';
import memberGetActivation from './controller/memberGetActivation';
import memberGetOverview from './controller/memberGetOverview';
import memberRefreshMembership from './controller/memberRefreshMembership';
import memberStartActivation from './controller/memberStartActivation';
import memberUpdateCard from './controller/memberUpdateCard';
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
  /** A member inside their cellar */
  member: createTRPCRouter({
    overview: memberGetOverview,
    activation: memberGetActivation,
    startActivation: memberStartActivation,
    completeActivation: memberCompleteActivation,
    updateCard: memberUpdateCard,
    refreshMembership: memberRefreshMembership,
    addIntake: memberAddIntake,
  }),
  /** Kevin and Laraine's side: Cellar members → Applications */
  admin: createTRPCRouter({
    listApplications: adminListApplications,
    approveApplication: adminApproveApplication,
    declineApplication: adminDeclineApplication,
    updateApplication: adminUpdateApplication,
    uploadApplicationIdentity: adminUploadApplicationIdentity,
    mergeApplication: adminMergeApplication,
    listInvites: adminListInvites,
    inviteMember: adminInviteMember,
    resendInvite: adminResendInvite,
    revokeInvite: adminRevokeInvite,
    listIntakes: adminListIntakes,
    addIntake: adminAddIntake,
    setIntakeStage: adminSetIntakeStage,
    linkIntakeShipment: adminLinkIntakeShipment,
    listLinkableShipments: adminListLinkableShipments,
    getStorage: adminGetStorage,
    pushExtraCases: adminPushExtraCases,
    setMembershipStatus: adminSetMembershipStatus,
  }),
});

export default onboardingRouter;
