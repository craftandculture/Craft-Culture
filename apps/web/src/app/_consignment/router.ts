import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDecideMandate from './controller/adminDecideMandate';
import adminGetMandates from './controller/adminGetMandates';
import memberBrowseCatalogue from './controller/memberBrowseCatalogue';
import memberGetMandates from './controller/memberGetMandates';
import memberOfferForSale from './controller/memberOfferForSale';
import memberWithdrawMandate from './controller/memberWithdrawMandate';

const memberRouter = createTRPCRouter({
  offerForSale: memberOfferForSale,
  withdrawMandate: memberWithdrawMandate,
  getMandates: memberGetMandates,
  browseCatalogue: memberBrowseCatalogue,
});

const adminRouter = createTRPCRouter({
  getMandates: adminGetMandates,
  decideMandate: adminDecideMandate,
});

const consignmentRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default consignmentRouter;
