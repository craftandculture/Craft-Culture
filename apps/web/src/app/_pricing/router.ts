import { createTRPCRouter } from '@/lib/trpc/trpc';

import configGet from './controller/configGet';
import configUpdate from './controller/configUpdate';
import fetchLatestExchangeRates from './controller/fetchLatestExchangeRates';
import orderOverrideCreate from './controller/orderOverrideCreate';
import partnerOverridesDelete from './controller/partnerOverridesDelete';
import partnerOverridesList from './controller/partnerOverridesList';
import partnerOverridesUpsert from './controller/partnerOverridesUpsert';
import sharedDefaultsGet from './controller/sharedDefaultsGet';

const pricingRouter = createTRPCRouter({
  getConfig: configGet,
  updateConfig: configUpdate,
  fetchLatestExchangeRates,
  createOrderOverride: orderOverrideCreate,
  listPartnerOverrides: partnerOverridesList,
  upsertPartnerOverride: partnerOverridesUpsert,
  deletePartnerOverride: partnerOverridesDelete,
  getSharedDefaults: sharedDefaultsGet,
});

export default pricingRouter;
