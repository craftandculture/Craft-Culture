import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminBatchCreateLocations from './controller/adminBatchCreateLocations';
import adminCreateLocation from './controller/adminCreateLocation';
import adminCreateSpecialLocation from './controller/adminCreateSpecialLocation';
import adminGetCaseByBarcode from './controller/adminGetCaseByBarcode';
import adminGetCaseLabels from './controller/adminGetCaseLabels';
import adminGetLocation from './controller/adminGetLocation';
import adminGetLocationByBarcode from './controller/adminGetLocationByBarcode';
import adminGetLocationLabels from './controller/adminGetLocationLabels';
import adminGetLocations from './controller/adminGetLocations';
import adminGetPendingShipments from './controller/adminGetPendingShipments';
import adminGetShipmentForReceiving from './controller/adminGetShipmentForReceiving';
import adminGetStockAtLocation from './controller/adminGetStockAtLocation';
import adminMarkLabelsPrinted from './controller/adminMarkLabelsPrinted';
import adminPutaway from './controller/adminPutaway';
import adminReceiveShipment from './controller/adminReceiveShipment';
import adminRepack from './controller/adminRepack';
import adminTransferStock from './controller/adminTransferStock';
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

const operationsRouter = createTRPCRouter({
  getCaseByBarcode: adminGetCaseByBarcode,
  getLocationByBarcode: adminGetLocationByBarcode,
  getStockAtLocation: adminGetStockAtLocation,
  putaway: adminPutaway,
  transfer: adminTransferStock,
  repack: adminRepack,
});

const adminRouter = createTRPCRouter({
  locations: locationsRouter,
  receiving: receivingRouter,
  labels: labelsRouter,
  operations: operationsRouter,
});

const wmsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default wmsRouter;
