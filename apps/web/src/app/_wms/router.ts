import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminBatchCreateLocations from './controller/adminBatchCreateLocations';
import adminCreateLocation from './controller/adminCreateLocation';
import adminCreateSpecialLocation from './controller/adminCreateSpecialLocation';
import adminGetCaseByBarcode from './controller/adminGetCaseByBarcode';
import adminGetCaseLabels from './controller/adminGetCaseLabels';
import adminGetExpiringStock from './controller/adminGetExpiringStock';
import adminGetLocation from './controller/adminGetLocation';
import adminGetLocationByBarcode from './controller/adminGetLocationByBarcode';
import adminGetLocationLabels from './controller/adminGetLocationLabels';
import adminGetLocations from './controller/adminGetLocations';
import adminGetMovementHistory from './controller/adminGetMovementHistory';
import adminGetPartnerRequests from './controller/adminGetPartnerRequests';
import adminGetPendingShipments from './controller/adminGetPendingShipments';
import adminGetShipmentForReceiving from './controller/adminGetShipmentForReceiving';
import adminGetStockAtLocation from './controller/adminGetStockAtLocation';
import adminGetStockByOwner from './controller/adminGetStockByOwner';
import adminGetStockByProduct from './controller/adminGetStockByProduct';
import adminGetStockOverview from './controller/adminGetStockOverview';
import adminMarkLabelsPrinted from './controller/adminMarkLabelsPrinted';
import adminPutaway from './controller/adminPutaway';
import adminReceiveShipment from './controller/adminReceiveShipment';
import adminReleaseReservation from './controller/adminReleaseReservation';
import adminRepack from './controller/adminRepack';
import adminReserveStock from './controller/adminReserveStock';
import adminResolvePartnerRequest from './controller/adminResolvePartnerRequest';
import adminSearchStock from './controller/adminSearchStock';
import adminTransferOwnership from './controller/adminTransferOwnership';
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

const stockRouter = createTRPCRouter({
  getOverview: adminGetStockOverview,
  getByProduct: adminGetStockByProduct,
  getByOwner: adminGetStockByOwner,
  getMovements: adminGetMovementHistory,
  getExpiring: adminGetExpiringStock,
  search: adminSearchStock,
});

const ownershipRouter = createTRPCRouter({
  transfer: adminTransferOwnership,
  reserve: adminReserveStock,
  release: adminReleaseReservation,
  getRequests: adminGetPartnerRequests,
  resolve: adminResolvePartnerRequest,
});

const adminRouter = createTRPCRouter({
  locations: locationsRouter,
  receiving: receivingRouter,
  labels: labelsRouter,
  operations: operationsRouter,
  stock: stockRouter,
  ownership: ownershipRouter,
});

const wmsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default wmsRouter;
