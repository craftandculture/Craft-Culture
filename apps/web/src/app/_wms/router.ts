import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminBatchCreateLocations from './controller/adminBatchCreateLocations';
import adminCreateLocation from './controller/adminCreateLocation';
import adminCreateSpecialLocation from './controller/adminCreateSpecialLocation';
import adminGetCaseLabels from './controller/adminGetCaseLabels';
import adminGetLocation from './controller/adminGetLocation';
import adminGetLocationLabels from './controller/adminGetLocationLabels';
import adminGetLocations from './controller/adminGetLocations';
import adminGetPendingShipments from './controller/adminGetPendingShipments';
import adminGetShipmentForReceiving from './controller/adminGetShipmentForReceiving';
import adminMarkLabelsPrinted from './controller/adminMarkLabelsPrinted';
import adminReceiveShipment from './controller/adminReceiveShipment';
import adminUpdateLocation from './controller/adminUpdateLocation';

const locationsRouter = createTRPCRouter({
  create: adminCreateLocation,
  createSpecial: adminCreateSpecialLocation,
  batchCreate: adminBatchCreateLocations,
  getMany: adminGetLocations,
  getOne: adminGetLocation,
  update: adminUpdateLocation,
});

const receivingRouter = createTRPCRouter({
  getPendingShipments: adminGetPendingShipments,
  getShipmentForReceiving: adminGetShipmentForReceiving,
  receiveShipment: adminReceiveShipment,
});

const labelsRouter = createTRPCRouter({
  getCaseLabels: adminGetCaseLabels,
  getLocationLabels: adminGetLocationLabels,
  markPrinted: adminMarkLabelsPrinted,
});

const adminRouter = createTRPCRouter({
  locations: locationsRouter,
  receiving: receivingRouter,
  labels: labelsRouter,
});

const wmsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default wmsRouter;
