import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetReleases from './controller/adminGetReleases';
import adminQuoteRelease from './controller/adminQuoteRelease';
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
});

const cellarRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default cellarRouter;
