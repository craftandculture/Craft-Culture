import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCancelPurchase from './controller/adminCancelPurchase';
import adminConfirmPurchasePayment from './controller/adminConfirmPurchasePayment';
import adminDecideMandate from './controller/adminDecideMandate';
import adminGetMandates from './controller/adminGetMandates';
import adminGetPurchases from './controller/adminGetPurchases';
import memberBrowseCatalogue from './controller/memberBrowseCatalogue';
import memberCancelPurchase from './controller/memberCancelPurchase';
import memberCreatePurchase from './controller/memberCreatePurchase';
import memberGetMandates from './controller/memberGetMandates';
import memberGetPurchases from './controller/memberGetPurchases';
import memberMarkPurchasePaid from './controller/memberMarkPurchasePaid';
import memberOfferForSale from './controller/memberOfferForSale';
import memberWithdrawMandate from './controller/memberWithdrawMandate';

const memberRouter = createTRPCRouter({
  offerForSale: memberOfferForSale,
  withdrawMandate: memberWithdrawMandate,
  getMandates: memberGetMandates,
  browseCatalogue: memberBrowseCatalogue,
  createPurchase: memberCreatePurchase,
  markPurchasePaid: memberMarkPurchasePaid,
  getPurchases: memberGetPurchases,
  cancelPurchase: memberCancelPurchase,
});

const adminRouter = createTRPCRouter({
  getMandates: adminGetMandates,
  decideMandate: adminDecideMandate,
  getPurchases: adminGetPurchases,
  confirmPurchasePayment: adminConfirmPurchasePayment,
  cancelPurchase: adminCancelPurchase,
});

const consignmentRouter = createTRPCRouter({
  member: memberRouter,
  admin: adminRouter,
});

export default consignmentRouter;
