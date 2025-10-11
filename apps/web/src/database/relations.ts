import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId
    }),
    accounts: r.many.accounts({
      from: r.users.id,
      to: r.accounts.userId
    }),
    passkeys: r.many.passkeys({
      from: r.users.id,
      to: r.passkeys.userId
    }),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
      optional: false
    })
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
      optional: false
    })
  },
  passkeys: {
    user: r.one.users({
      from: r.passkeys.userId,
      to: r.users.id,
      optional: false
    })
  },
  products: {
    productOffers: r.many.productOffers({
      from: r.products.id,
      to: r.productOffers.productId
    })
  },
  productOffers: {
    product: r.one.products({
      from: r.productOffers.productId,
      to: r.products.id,
      optional: false
    })
  },
}));

export default relations;
