import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddBay from './controller/adminAddBay';
import adminAddCaseToPallet from './controller/adminAddCaseToPallet';
import adminAddOrdersToBatch from './controller/adminAddOrdersToBatch';
import adminAddZohoOrdersToBatch from './controller/adminAddZohoOrdersToBatch';
import adminAdjustStockQuantity from './controller/adminAdjustStockQuantity';
import adminAssignPickList from './controller/adminAssignPickList';
import adminAutoFixStock from './controller/adminAutoFixStock';
import adminBatchCreateLocations from './controller/adminBatchCreateLocations';
import adminCompletePickList from './controller/adminCompletePickList';
import adminCreateCaseLabels from './controller/adminCreateCaseLabels';
import adminCreateDispatchBatch from './controller/adminCreateDispatchBatch';
import adminCreateLocation from './controller/adminCreateLocation';
import adminCreatePallet from './controller/adminCreatePallet';
import adminCreatePickList from './controller/adminCreatePickList';
import adminCreateSpecialLocation from './controller/adminCreateSpecialLocation';
import adminDeduplicateStock from './controller/adminDeduplicateStock';
import adminDeleteBay from './controller/adminDeleteBay';
import adminDeletePickList from './controller/adminDeletePickList';
import adminDeleteReceivingDraft from './controller/adminDeleteReceivingDraft';
import adminDeleteStockRecord from './controller/adminDeleteStockRecord';
import adminDispatchPallet from './controller/adminDispatchPallet';
import adminDissolvePallet from './controller/adminDissolvePallet';
import adminFinalizeReceiving from './controller/adminFinalizeReceiving';
import adminGenerateDeliveryNote from './controller/adminGenerateDeliveryNote';
import adminGetAllStockRecords from './controller/adminGetAllStockRecords';
import adminGetBayDetails from './controller/adminGetBayDetails';
import adminGetBayTotems from './controller/adminGetBayTotems';
import adminGetCaseByBarcode from './controller/adminGetCaseByBarcode';
import adminGetCaseLabels from './controller/adminGetCaseLabels';
import adminGetDispatchBatch from './controller/adminGetDispatchBatch';
import adminGetDispatchBatches from './controller/adminGetDispatchBatches';
import adminGetExpiringStock from './controller/adminGetExpiringStock';
import adminGetLocation from './controller/adminGetLocation';
import adminGetLocationByBarcode from './controller/adminGetLocationByBarcode';
import adminGetLocationLabels from './controller/adminGetLocationLabels';
import adminGetLocations from './controller/adminGetLocations';
import adminGetMovementHistory from './controller/adminGetMovementHistory';
import adminGetPallet from './controller/adminGetPallet';
import adminGetPalletByBarcode from './controller/adminGetPalletByBarcode';
import adminGetPalletLabel from './controller/adminGetPalletLabel';
import adminGetPallets from './controller/adminGetPallets';
import adminGetPartnerRequests from './controller/adminGetPartnerRequests';
import adminGetPendingShipments from './controller/adminGetPendingShipments';
import adminGetPickList from './controller/adminGetPickList';
import adminGetPickLists from './controller/adminGetPickLists';
import adminGetReceivingDraft from './controller/adminGetReceivingDraft';
import adminGetShipmentForReceiving from './controller/adminGetShipmentForReceiving';
import adminGetStockAtLocation from './controller/adminGetStockAtLocation';
import adminGetStockByOwner from './controller/adminGetStockByOwner';
import adminGetStockByProduct from './controller/adminGetStockByProduct';
import adminGetStockOverview from './controller/adminGetStockOverview';
import adminImportStock from './controller/adminImportStock';
import adminMarkLabelsPrinted from './controller/adminMarkLabelsPrinted';
import adminMovePallet from './controller/adminMovePallet';
import adminPickItem from './controller/adminPickItem';
import adminPrintStockLabel from './controller/adminPrintStockLabel';
import adminPutaway from './controller/adminPutaway';
import adminRebuildStockFromMovements from './controller/adminRebuildStockFromMovements';
import adminReceiveShipment from './controller/adminReceiveShipment';
import adminReceiveShipmentItem from './controller/adminReceiveShipmentItem';
import adminReconcileStock from './controller/adminReconcileStock';
import adminReleaseReservation from './controller/adminReleaseReservation';
import adminRemoveCaseFromPallet from './controller/adminRemoveCaseFromPallet';
import adminRemoveOrderFromBatch from './controller/adminRemoveOrderFromBatch';
import adminRepack from './controller/adminRepack';
import adminReprintCaseLabels from './controller/adminReprintCaseLabels';
import adminReserveStock from './controller/adminReserveStock';
import adminResolvePartnerRequest from './controller/adminResolvePartnerRequest';
import adminSaveReceivingDraft from './controller/adminSaveReceivingDraft';
import adminSealPallet from './controller/adminSealPallet';
import adminSearchStock from './controller/adminSearchStock';
import adminSyncStockToZoho from './controller/adminSyncStockToZoho';
import adminTransferOwnership from './controller/adminTransferOwnership';
import adminTransferStock from './controller/adminTransferStock';
import adminUnsealPallet from './controller/adminUnsealPallet';
import adminUpdateBatchStatus from './controller/adminUpdateBatchStatus';
import adminUpdateBay from './controller/adminUpdateBay';
import adminUpdateLocation from './controller/adminUpdateLocation';
import adminUploadReceivingPhoto from './controller/adminUploadReceivingPhoto';
import deviceGetBayTotems from './controller/deviceGetBayTotems';
import deviceGetLocationLabels from './controller/deviceGetLocationLabels';
import partnerGetStock from './controller/partnerGetStock';

const locationsRouter = createTRPCRouter({
  create: adminCreateLocation,
  createSpecial: adminCreateSpecialLocation,
  batchCreate: adminBatchCreateLocations,
  addBay: adminAddBay,
  deleteBay: adminDeleteBay,
  getBayDetails: adminGetBayDetails,
  updateBay: adminUpdateBay,
  getMany: adminGetLocations,
  getOne: adminGetLocation,
  update: adminUpdateLocation,
});

const receivingRouter = createTRPCRouter({
  getPendingShipments: adminGetPendingShipments,
  getShipmentForReceiving: adminGetShipmentForReceiving,
  receiveShipment: adminReceiveShipment,
  receiveShipmentItem: adminReceiveShipmentItem,
  finalizeReceiving: adminFinalizeReceiving,
  getDraft: adminGetReceivingDraft,
  saveDraft: adminSaveReceivingDraft,
  deleteDraft: adminDeleteReceivingDraft,
  uploadPhoto: adminUploadReceivingPhoto,
});

const labelsRouter = createTRPCRouter({
  createCaseLabels: adminCreateCaseLabels,
  getCaseLabels: adminGetCaseLabels,
  reprintCaseLabels: adminReprintCaseLabels,
  printStockLabel: adminPrintStockLabel,
  getLocationLabels: adminGetLocationLabels,
  getBayTotems: adminGetBayTotems,
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
  deduplicate: adminDeduplicateStock,
  getAll: adminGetAllStockRecords,
  reconcile: adminReconcileStock,
  deleteRecord: adminDeleteStockRecord,
  autoFix: adminAutoFixStock,
  rebuildFromMovements: adminRebuildStockFromMovements,
  import: adminImportStock,
  adjustQuantity: adminAdjustStockQuantity,
  syncToZoho: adminSyncStockToZoho,
});

const ownershipRouter = createTRPCRouter({
  transfer: adminTransferOwnership,
  reserve: adminReserveStock,
  release: adminReleaseReservation,
  getRequests: adminGetPartnerRequests,
  resolve: adminResolvePartnerRequest,
});

const pickingRouter = createTRPCRouter({
  create: adminCreatePickList,
  delete: adminDeletePickList,
  getMany: adminGetPickLists,
  getOne: adminGetPickList,
  assign: adminAssignPickList,
  pickItem: adminPickItem,
  complete: adminCompletePickList,
});

const dispatchRouter = createTRPCRouter({
  create: adminCreateDispatchBatch,
  getMany: adminGetDispatchBatches,
  getOne: adminGetDispatchBatch,
  addOrders: adminAddOrdersToBatch,
  addZohoOrders: adminAddZohoOrdersToBatch,
  removeOrder: adminRemoveOrderFromBatch,
  updateStatus: adminUpdateBatchStatus,
  generateDeliveryNote: adminGenerateDeliveryNote,
});

const palletRouter = createTRPCRouter({
  create: adminCreatePallet,
  addCase: adminAddCaseToPallet,
  removeCase: adminRemoveCaseFromPallet,
  seal: adminSealPallet,
  unseal: adminUnsealPallet,
  dissolve: adminDissolvePallet,
  dispatch: adminDispatchPallet,
  move: adminMovePallet,
  getOne: adminGetPallet,
  getMany: adminGetPallets,
  getByBarcode: adminGetPalletByBarcode,
  getLabel: adminGetPalletLabel,
});

const adminRouter = createTRPCRouter({
  locations: locationsRouter,
  receiving: receivingRouter,
  labels: labelsRouter,
  operations: operationsRouter,
  stock: stockRouter,
  ownership: ownershipRouter,
  picking: pickingRouter,
  dispatch: dispatchRouter,
  pallets: palletRouter,
});

const partnerRouter = createTRPCRouter({
  getStock: partnerGetStock,
});

/** Device-authenticated routes for WMS terminals (TC27/Enterprise Browser) */
const deviceLabelsRouter = createTRPCRouter({
  getLocationLabels: deviceGetLocationLabels,
  getBayTotems: deviceGetBayTotems,
});

const deviceRouter = createTRPCRouter({
  labels: deviceLabelsRouter,
});

const wmsRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
  device: deviceRouter,
});

export default wmsRouter;
