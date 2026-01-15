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
// @deprecated Legacy pricing model relation - no longer used
    pricingModel: r.one.pricingModels({
      from: r.users.pricingModelId,
      to: r.pricingModels.id,
      optional: true,
    }),
    partner: r.one.partners({
      from: r.users.id,
      to: r.partners.userId,
      optional: true,
    }),
  },
// @deprecated Legacy sheets relations - no longer used
  sheets: {
    pricingModels: r.many.pricingModels({
      from: r.sheets.id,
      to: r.pricingModels.sheetId,
    }),
  },
  // @deprecated Legacy pricing models relations - no longer used
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
  partners: {
    user: r.one.users({
      from: r.partners.userId,
      to: r.users.id,
      optional: true,
    }),
    apiKeys: r.many.partnerApiKeys({
      from: r.partners.id,
      to: r.partnerApiKeys.partnerId,
    }),
    apiRequestLogs: r.many.partnerApiRequestLogs({
      from: r.partners.id,
      to: r.partnerApiRequestLogs.partnerId,
    }),
    // Private client orders where this partner is the creator
    privateClientOrdersAsPartner: r.many.privateClientOrders({
      from: r.partners.id,
      to: r.privateClientOrders.partnerId,
    }),
    // Private client orders where this partner is the distributor
    privateClientOrdersAsDistributor: r.many.privateClientOrders({
      from: r.partners.id,
      to: r.privateClientOrders.distributorId,
    }),
    // Private client contacts owned by this partner
    privateClientContacts: r.many.privateClientContacts({
      from: r.partners.id,
      to: r.privateClientContacts.partnerId,
    }),
    // Bespoke pricing override for this partner
    pricingOverride: r.one.partnerPricingOverrides({
      from: r.partners.id,
      to: r.partnerPricingOverrides.partnerId,
      optional: true,
    }),
  },
  partnerApiKeys: {
    partner: r.one.partners({
      from: r.partnerApiKeys.partnerId,
      to: r.partners.id,
      optional: false,
    }),
    revokedByUser: r.one.users({
      from: r.partnerApiKeys.revokedBy,
      to: r.users.id,
      optional: true,
    }),
    apiRequestLogs: r.many.partnerApiRequestLogs({
      from: r.partnerApiKeys.id,
      to: r.partnerApiRequestLogs.apiKeyId,
    }),
  },
  partnerApiRequestLogs: {
    apiKey: r.one.partnerApiKeys({
      from: r.partnerApiRequestLogs.apiKeyId,
      to: r.partnerApiKeys.id,
      optional: true,
    }),
    partner: r.one.partners({
      from: r.partnerApiRequestLogs.partnerId,
      to: r.partners.id,
      optional: true,
    }),
  },
  // Private Client Orders relations
  privateClientOrders: {
    partner: r.one.partners({
      from: r.privateClientOrders.partnerId,
      to: r.partners.id,
      optional: false,
    }),
    distributor: r.one.partners({
      from: r.privateClientOrders.distributorId,
      to: r.partners.id,
      optional: true,
    }),
    client: r.one.privateClientContacts({
      from: r.privateClientOrders.clientId,
      to: r.privateClientContacts.id,
      optional: true,
    }),
    items: r.many.privateClientOrderItems({
      from: r.privateClientOrders.id,
      to: r.privateClientOrderItems.orderId,
    }),
    documents: r.many.privateClientOrderDocuments({
      from: r.privateClientOrders.id,
      to: r.privateClientOrderDocuments.orderId,
    }),
    activityLogs: r.many.privateClientOrderActivityLogs({
      from: r.privateClientOrders.id,
      to: r.privateClientOrderActivityLogs.orderId,
    }),
  },
  privateClientOrderItems: {
    order: r.one.privateClientOrders({
      from: r.privateClientOrderItems.orderId,
      to: r.privateClientOrders.id,
      optional: false,
    }),
    product: r.one.products({
      from: r.privateClientOrderItems.productId,
      to: r.products.id,
      optional: true,
    }),
    productOffer: r.one.productOffers({
      from: r.privateClientOrderItems.productOfferId,
      to: r.productOffers.id,
      optional: true,
    }),
  },
  privateClientOrderDocuments: {
    order: r.one.privateClientOrders({
      from: r.privateClientOrderDocuments.orderId,
      to: r.privateClientOrders.id,
      optional: false,
    }),
    uploadedByUser: r.one.users({
      from: r.privateClientOrderDocuments.uploadedBy,
      to: r.users.id,
      optional: true,
    }),
  },
  privateClientOrderActivityLogs: {
    order: r.one.privateClientOrders({
      from: r.privateClientOrderActivityLogs.orderId,
      to: r.privateClientOrders.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.privateClientOrderActivityLogs.userId,
      to: r.users.id,
      optional: true,
    }),
    partner: r.one.partners({
      from: r.privateClientOrderActivityLogs.partnerId,
      to: r.partners.id,
      optional: true,
    }),
  },
  privateClientContacts: {
    partner: r.one.partners({
      from: r.privateClientContacts.partnerId,
      to: r.partners.id,
      optional: false,
    }),
    orders: r.many.privateClientOrders({
      from: r.privateClientContacts.id,
      to: r.privateClientOrders.clientId,
    }),
  },
  // Partner pricing overrides
  partnerPricingOverrides: {
    partner: r.one.partners({
      from: r.partnerPricingOverrides.partnerId,
      to: r.partners.id,
      optional: false,
    }),
    createdByUser: r.one.users({
      from: r.partnerPricingOverrides.createdBy,
      to: r.users.id,
      optional: true,
    }),
  },
  // ============================================================================
  // Logistics Module Relations
  // ============================================================================
  logisticsShipments: {
    partner: r.one.partners({
      from: r.logisticsShipments.partnerId,
      to: r.partners.id,
      optional: true,
    }),
    clientContact: r.one.privateClientContacts({
      from: r.logisticsShipments.clientContactId,
      to: r.privateClientContacts.id,
      optional: true,
    }),
    createdByUser: r.one.users({
      from: r.logisticsShipments.createdBy,
      to: r.users.id,
      optional: true,
    }),
    items: r.many.logisticsShipmentItems({
      from: r.logisticsShipments.id,
      to: r.logisticsShipmentItems.shipmentId,
    }),
    documents: r.many.logisticsDocuments({
      from: r.logisticsShipments.id,
      to: r.logisticsDocuments.shipmentId,
    }),
    activityLogs: r.many.logisticsShipmentActivityLogs({
      from: r.logisticsShipments.id,
      to: r.logisticsShipmentActivityLogs.shipmentId,
    }),
  },
  logisticsShipmentItems: {
    shipment: r.one.logisticsShipments({
      from: r.logisticsShipmentItems.shipmentId,
      to: r.logisticsShipments.id,
      optional: false,
    }),
    product: r.one.products({
      from: r.logisticsShipmentItems.productId,
      to: r.products.id,
      optional: true,
    }),
  },
  logisticsDocuments: {
    shipment: r.one.logisticsShipments({
      from: r.logisticsDocuments.shipmentId,
      to: r.logisticsShipments.id,
      optional: false,
    }),
    uploadedByUser: r.one.users({
      from: r.logisticsDocuments.uploadedBy,
      to: r.users.id,
      optional: true,
    }),
    verifiedByUser: r.one.users({
      from: r.logisticsDocuments.verifiedBy,
      to: r.users.id,
      optional: true,
    }),
  },
  logisticsShipmentActivityLogs: {
    shipment: r.one.logisticsShipments({
      from: r.logisticsShipmentActivityLogs.shipmentId,
      to: r.logisticsShipments.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.logisticsShipmentActivityLogs.userId,
      to: r.users.id,
      optional: true,
    }),
    partner: r.one.partners({
      from: r.logisticsShipmentActivityLogs.partnerId,
      to: r.partners.id,
      optional: true,
    }),
  },
  logisticsRateCards: {
    createdByUser: r.one.users({
      from: r.logisticsRateCards.createdBy,
      to: r.users.id,
      optional: true,
    }),
  },
}));

export default relations;
