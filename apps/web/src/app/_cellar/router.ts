import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetMemberIdentity from './controller/adminGetMemberIdentity';
import adminGetMembers from './controller/adminGetMembers';
import adminGetReleaseRates from './controller/adminGetReleaseRates';
import adminGetReleases from './controller/adminGetReleases';
import adminQuoteRelease from './controller/adminQuoteRelease';
import adminSetReleaseRates from './controller/adminSetReleaseRates';
import memberAcceptRelease from './controller/memberAcceptRelease';
import memberAmendRelease from './controller/memberAmendRelease';
import memberDeleteIdentityDocument from './controller/memberDeleteIdentityDocument';
import memberEstimateRelease from './controller/memberEstimateRelease';
import memberGetProfile from './controller/memberGetProfile';
import memberGetReleases from './controller/memberGetReleases';
import memberSaveDeliveryAddress from './controller/memberSaveDeliveryAddress';
import memberSaveProfile from './controller/memberSaveProfile';
import memberSaveRelease from './controller/memberSaveRelease';
import memberSubmitRelease from './controller/memberSubmitRelease';
import memberUploadIdentityDocument from './controller/memberUploadIdentityDocument';
import memberWithdrawRelease from './controller/memberWithdrawRelease';

const memberRouter = createTRPCRouter({
  getProfile: memberGetProfile,
  estimateRelease: memberEstimateRelease,
  saveProfile: memberSaveProfile,
  saveDeliveryAddress: memberSaveDeliveryAddress,
  uploadIdentityDocument: memberUploadIdentityDocument,
  deleteIdentityDocument: memberDeleteIdentityDocument,
  getReleases: memberGetReleases,
  amendRelease: memberAmendRelease,
  withdrawRelease: memberWithdrawRelease,
  saveRelease: memberSaveRelease,
  submitRelease: memberSubmitRelease,
  acceptRelease: memberAcceptRelease,
});

const adminRouter = createTRPCRouter({
  getReleases: adminGetReleases,
  quoteRelease: adminQuoteRelease,
  getMembers: adminGetMembers,
  getMemberIdentity: adminGetMemberIdentity,
  getReleaseRates: adminGetReleaseRates,
  setReleaseRates: adminSetReleaseRates,
});

const cellarRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default cellarRouter;
