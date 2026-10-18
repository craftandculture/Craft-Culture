import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAllocate from './controller/adminAllocate';
import adminCloseAllocation from './controller/adminCloseAllocation';
import adminCreateAllocation from './controller/adminCreateAllocation';
import adminGetSourcing from './controller/adminGetSourcing';
import adminSendSourcingOffer from './controller/adminSendSourcingOffer';
import adminUpdateSourcingRequest from './controller/adminUpdateSourcingRequest';
import memberCreateSourcingRequest from './controller/memberCreateSourcingRequest';
import memberGetSourcing from './controller/memberGetSourcing';
import memberRegisterAllocationInterest from './controller/memberRegisterAllocationInterest';
import memberRespondAllocation from './controller/memberRespondAllocation';
import memberRespondSourcingOffer from './controller/memberRespondSourcingOffer';
import memberSearchWines from './controller/memberSearchWines';
import memberWithdrawSourcingRequest from './controller/memberWithdrawSourcingRequest';

const memberRouter = createTRPCRouter({
  get: memberGetSourcing,
  searchWines: memberSearchWines,
  createRequest: memberCreateSourcingRequest,
  withdrawRequest: memberWithdrawSourcingRequest,
  respondOffer: memberRespondSourcingOffer,
  registerInterest: memberRegisterAllocationInterest,
  respondAllocation: memberRespondAllocation,
});

const adminRouter = createTRPCRouter({
  get: adminGetSourcing,
  updateRequest: adminUpdateSourcingRequest,
  sendOffer: adminSendSourcingOffer,
  createAllocation: adminCreateAllocation,
  closeAllocation: adminCloseAllocation,
  allocate: adminAllocate,
});

/** Wines members ask us to find, and allocations offered to members first */
const cellarSourcingRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default cellarSourcingRouter;
