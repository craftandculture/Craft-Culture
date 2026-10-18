import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAssignUkRotation from './controller/adminAssignUkRotation';
import adminEncryptIdentityDocuments from './controller/adminEncryptIdentityDocuments';
import adminGetAttention from './controller/adminGetAttention';
import adminGetMemberIdentity from './controller/adminGetMemberIdentity';
import adminGetMembers from './controller/adminGetMembers';
import adminGetPaymentDetails from './controller/adminGetPaymentDetails';
import adminGetReleaseRates from './controller/adminGetReleaseRates';
import adminGetReleases from './controller/adminGetReleases';
import adminGetUkMoves from './controller/adminGetUkMoves';
import adminGetUkStock from './controller/adminGetUkStock';
import adminImportUkStock from './controller/adminImportUkStock';
import adminQuoteRelease from './controller/adminQuoteRelease';
import adminQuoteUkMove from './controller/adminQuoteUkMove';
import adminSetPaymentDetails from './controller/adminSetPaymentDetails';
import adminSetReleaseRates from './controller/adminSetReleaseRates';
import adminShipUkMove from './controller/adminShipUkMove';
import memberAcceptRelease from './controller/memberAcceptRelease';
import memberAcceptUkMove from './controller/memberAcceptUkMove';
import memberAmendRelease from './controller/memberAmendRelease';
import memberDeleteIdentityDocument from './controller/memberDeleteIdentityDocument';
import memberEstimateRelease from './controller/memberEstimateRelease';
import memberGetProfile from './controller/memberGetProfile';
import memberGetReleases from './controller/memberGetReleases';
import memberGetStatement from './controller/memberGetStatement';
import memberGetUkHoldings from './controller/memberGetUkHoldings';
import memberGetUkMoves from './controller/memberGetUkMoves';
import memberRequestUkMove from './controller/memberRequestUkMove';
import memberSaveDeliveryAddress from './controller/memberSaveDeliveryAddress';
import memberSaveProfile from './controller/memberSaveProfile';
import memberSaveRelease from './controller/memberSaveRelease';
import memberSubmitRelease from './controller/memberSubmitRelease';
import memberUploadIdentityDocument from './controller/memberUploadIdentityDocument';
import memberWithdrawRelease from './controller/memberWithdrawRelease';
import memberWithdrawUkMove from './controller/memberWithdrawUkMove';

const memberRouter = createTRPCRouter({
  getProfile: memberGetProfile,
  estimateRelease: memberEstimateRelease,
  saveProfile: memberSaveProfile,
  saveDeliveryAddress: memberSaveDeliveryAddress,
  uploadIdentityDocument: memberUploadIdentityDocument,
  deleteIdentityDocument: memberDeleteIdentityDocument,
  getReleases: memberGetReleases,
  getUkHoldings: memberGetUkHoldings,
  getStatement: memberGetStatement,
  getUkMoves: memberGetUkMoves,
  requestUkMove: memberRequestUkMove,
  withdrawUkMove: memberWithdrawUkMove,
  acceptUkMove: memberAcceptUkMove,
  amendRelease: memberAmendRelease,
  withdrawRelease: memberWithdrawRelease,
  saveRelease: memberSaveRelease,
  submitRelease: memberSubmitRelease,
  acceptRelease: memberAcceptRelease,
});

const adminRouter = createTRPCRouter({
  getAttention: adminGetAttention,
  getReleases: adminGetReleases,
  quoteRelease: adminQuoteRelease,
  getMembers: adminGetMembers,
  getUkStock: adminGetUkStock,
  importUkStock: adminImportUkStock,
  assignUkRotation: adminAssignUkRotation,
  getUkMoves: adminGetUkMoves,
  quoteUkMove: adminQuoteUkMove,
  shipUkMove: adminShipUkMove,
  getMemberIdentity: adminGetMemberIdentity,
  encryptIdentityDocuments: adminEncryptIdentityDocuments,
  getPaymentDetails: adminGetPaymentDetails,
  setPaymentDetails: adminSetPaymentDetails,
  getReleaseRates: adminGetReleaseRates,
  setReleaseRates: adminSetReleaseRates,
});

const cellarRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default cellarRouter;
