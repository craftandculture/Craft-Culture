import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetMembers from './controller/adminGetMembers';
import adminGetReleaseRates from './controller/adminGetReleaseRates';
import adminGetReleases from './controller/adminGetReleases';
import adminQuoteRelease from './controller/adminQuoteRelease';
import adminSetReleaseRates from './controller/adminSetReleaseRates';
import memberAcceptRelease from './controller/memberAcceptRelease';
import memberGetReleases from './controller/memberGetReleases';
import memberSaveRelease from './controller/memberSaveRelease';
import memberSubmitRelease from './controller/memberSubmitRelease';

const memberRouter = createTRPCRouter({
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
