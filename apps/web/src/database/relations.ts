import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId,
    }),
    accounts: r.many.accounts({
      from: r.users.id,
      to: r.accounts.userId,
    }),
    passkeys: r.many.passkeys({
      from: r.users.id,
      to: r.passkeys.userId,
    }),
    quotes: r.many.quotes({
      from: r.users.id,
      to: r.quotes.userId,
    }),
    pricingModel: r.one.pricingModels({
      from: r.users.pricingModelId,
      to: r.pricingModels.id,
      optional: true,
    }),
  },
  sheets: {
    pricingModels: r.many.pricingModels({
      from: r.sheets.id,
      to: r.pricingModels.sheetId,
    }),
  },
  pricingModels: {
    users: r.many.users({
      from: r.pricingModels.id,
      to: r.users.pricingModelId,
    }),
    sheet: r.one.sheets({
      from: r.pricingModels.sheetId,
      to: r.sheets.id,
      optional: false,
    }),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  passkeys: {
    user: r.one.users({
      from: r.passkeys.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  products: {
    productOffers: r.many.productOffers({
      from: r.products.id,
      to: r.productOffers.productId,
    }),
  },
  productOffers: {
    product: r.one.products({
      from: r.productOffers.productId,
      to: r.products.id,
      optional: false,
    }),
  },
  quotes: {
    user: r.one.users({
      from: r.quotes.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}));

export default relations;
