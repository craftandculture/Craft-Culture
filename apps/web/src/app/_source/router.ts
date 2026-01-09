import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminBulkSelectQuotes from './controller/adminBulkSelectQuotes';
import adminCreateRfq from './controller/adminCreateRfq';
import adminDeleteItem from './controller/adminDeleteItem';
import adminDeleteRfq from './controller/adminDeleteRfq';
import adminGenerateFinalQuote from './controller/adminGenerateFinalQuote';
import adminGetManyRfqs from './controller/adminGetManyRfqs';
import adminGetOneRfq from './controller/adminGetOneRfq';
import adminParseInput from './controller/adminParseInput';
import adminSelectQuote from './controller/adminSelectQuote';
import adminSendToPartners from './controller/adminSendToPartners';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateRfq from './controller/adminUpdateRfq';
import partnerDeclineRfq from './controller/partnerDeclineRfq';
import partnerGetManyRfqs from './controller/partnerGetManyRfqs';
import partnerGetOneRfq from './controller/partnerGetOneRfq';
import partnerSubmitQuotes from './controller/partnerSubmitQuotes';

const adminRouter = createTRPCRouter({
  create: adminCreateRfq,
  getMany: adminGetManyRfqs,
  getOne: adminGetOneRfq,
  update: adminUpdateRfq,
  delete: adminDeleteRfq,
  addItem: adminAddItem,
  updateItem: adminUpdateItem,
  deleteItem: adminDeleteItem,
  sendToPartners: adminSendToPartners,
  selectQuote: adminSelectQuote,
  bulkSelectQuotes: adminBulkSelectQuotes,
  generateFinalQuote: adminGenerateFinalQuote,
  parseInput: adminParseInput,
});

const partnerRouter = createTRPCRouter({
  getMany: partnerGetManyRfqs,
  getOne: partnerGetOneRfq,
  submitQuotes: partnerSubmitQuotes,
  decline: partnerDeclineRfq,
});

const sourceRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
});

export default sourceRouter;
