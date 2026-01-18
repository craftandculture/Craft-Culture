import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminCalculateLandedCost from './controller/adminCalculateLandedCost';
import adminCreate from './controller/adminCreate';
import adminDeleteDocument from './controller/adminDeleteDocument';
import adminExportCompliancePdf from './controller/adminExportCompliancePdf';
import adminExportLandedCostExcel from './controller/adminExportLandedCostExcel';
import adminGetDocumentCompliance from './controller/adminGetDocumentCompliance';
import adminGetHillebrandEvents from './controller/adminGetHillebrandEvents';
import adminGetLandedCostReport from './controller/adminGetLandedCostReport';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminGetReportMetrics from './controller/adminGetReportMetrics';
import adminRemoveItem from './controller/adminRemoveItem';
import adminSyncHillebrand from './controller/adminSyncHillebrand';
import adminSyncHillebrandDocuments from './controller/adminSyncHillebrandDocuments';
import adminSyncHillebrandInvoices from './controller/adminSyncHillebrandInvoices';
import adminUpdate from './controller/adminUpdate';
import adminUpdateStatus from './controller/adminUpdateStatus';
import adminUploadDocument from './controller/adminUploadDocument';
import partnerGetMany from './controller/partnerGetMany';
import partnerGetOne from './controller/partnerGetOne';
import partnerUploadDocument from './controller/partnerUploadDocument';

const adminRouter = createTRPCRouter({
  // Shipment CRUD
  create: adminCreate,
  getMany: adminGetMany,
  getOne: adminGetOne,
  update: adminUpdate,
  updateStatus: adminUpdateStatus,

  // Items
  addItem: adminAddItem,
  removeItem: adminRemoveItem,

  // Documents
  uploadDocument: adminUploadDocument,
  deleteDocument: adminDeleteDocument,

  // Landed cost
  calculateLandedCost: adminCalculateLandedCost,

  // Hillebrand sync
  syncHillebrand: adminSyncHillebrand,
  syncHillebrandInvoices: adminSyncHillebrandInvoices,
  syncHillebrandDocuments: adminSyncHillebrandDocuments,
  getHillebrandEvents: adminGetHillebrandEvents,

  // Reports
  getReportMetrics: adminGetReportMetrics,
  getDocumentCompliance: adminGetDocumentCompliance,
  getLandedCostReport: adminGetLandedCostReport,

  // Exports
  exportLandedCostExcel: adminExportLandedCostExcel,
  exportCompliancePdf: adminExportCompliancePdf,
});

const partnerRouter = createTRPCRouter({
  getMany: partnerGetMany,
  getOne: partnerGetOne,
  uploadDocument: partnerUploadDocument,
});

const logisticsRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
});

export default logisticsRouter;
