import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetMembers from './controller/adminGetMembers';
import adminGetReleaseRates from './controller/adminGetReleaseRates';
import adminGetReleases from './controller/adminGetReleases';
import adminQuoteRelease from './controller/adminQuoteRelease';
import adminSetReleaseRates from './controller/adminSetReleaseRates';
import memberAcceptRelease from './controller/memberAcceptRelease';
import memberGetProfile from './controller/memberGetProfile';
import memberGetReleases from './controller/memberGetReleases';
import memberSaveDeliveryAddress from './controller/memberSaveDeliveryAddress';
import memberSaveRelease from './controller/memberSaveRelease';
import memberSubmitRelease from './controller/memberSubmitRelease';

const memberRouter = createTRPCRouter({
  getProfile: memberGetProfile,
  saveDeliveryAddress: memberSaveDeliveryAddress,
  getReleases: memberGetReleases,
  saveRelease: memberSaveRelease,
  submitRelease: memberSubmitRelease,
  acceptRelease: memberAcceptRelease,
});

const adminRouter = createTRPCRouter({
  getReleases: adminGetReleases,
  quoteRelease: adminQuoteRelease,
  getMembers: adminGetMembers,
  getReleaseRates: adminGetReleaseRates,
  setReleaseRates: adminSetReleaseRates,
});

const cellarRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default cellarRouter;
