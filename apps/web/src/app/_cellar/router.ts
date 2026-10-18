import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAssignUkRotation from './controller/adminAssignUkRotation';
import adminEncryptIdentityDocuments from './controller/adminEncryptIdentityDocuments';
import adminGetAttention from './controller/adminGetAttention';
import adminGetCellarAccess from './controller/adminGetCellarAccess';
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
import adminRevokeCellarAccess from './controller/adminRevokeCellarAccess';
import adminSetPaymentDetails from './controller/adminSetPaymentDetails';
import adminSetReleaseRates from './controller/adminSetReleaseRates';
import adminShipUkMove from './controller/adminShipUkMove';
import claimCellarAccess from './controller/claimCellarAccess';
import leaveCellarAccess from './controller/leaveCellarAccess';
import memberAcceptRelease from './controller/memberAcceptRelease';
import memberAcceptUkMove from './controller/memberAcceptUkMove';
import memberAmendRelease from './controller/memberAmendRelease';
import memberChangeAccess from './controller/memberChangeAccess';
import memberDeleteAddress from './controller/memberDeleteAddress';
import memberDeleteIdentityDocument from './controller/memberDeleteIdentityDocument';
import memberEstimateRelease from './controller/memberEstimateRelease';
import memberGetAccess from './controller/memberGetAccess';
import memberGetAddresses from './controller/memberGetAddresses';
import memberGetProfile from './controller/memberGetProfile';
import memberGetReleases from './controller/memberGetReleases';
import memberGetStatement from './controller/memberGetStatement';
import memberGetUkHoldings from './controller/memberGetUkHoldings';
import memberGetUkMoves from './controller/memberGetUkMoves';
import memberInviteAccess from './controller/memberInviteAccess';
import memberRequestUkMove from './controller/memberRequestUkMove';
import memberRevokeAccess from './controller/memberRevokeAccess';
import memberSaveAddress from './controller/memberSaveAddress';
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
  getAddresses: memberGetAddresses,
  saveAddress: memberSaveAddress,
  deleteAddress: memberDeleteAddress,
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

/*
  Shared access to a cellar (a spouse or PA). Its own router: accepting and
  leaving are open to any signed-in person, the holder's controls are
  holder-only, and the staff view is staff-only — each procedure carries its
  own gate.
*/
const accessRouter = createTRPCRouter({
  get: memberGetAccess,
  invite: memberInviteAccess,
  change: memberChangeAccess,
  revoke: memberRevokeAccess,
  claim: claimCellarAccess,
  leave: leaveCellarAccess,
  adminList: adminGetCellarAccess,
  adminRevoke: adminRevokeCellarAccess,
});

const cellarRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
  access: accessRouter,
});

export default cellarRouter;
