import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAcceptQuote from './controller/adminAcceptQuote';
import adminAddItem from './controller/adminAddItem';
import adminCalculateLandedCost from './controller/adminCalculateLandedCost';
import adminCompareQuotes from './controller/adminCompareQuotes';
import adminCreate from './controller/adminCreate';
import adminCreateQuote from './controller/adminCreateQuote';
import adminDeleteDocument from './controller/adminDeleteDocument';
import adminExportCompliancePdf from './controller/adminExportCompliancePdf';
import adminExportLandedCostExcel from './controller/adminExportLandedCostExcel';
import adminExtractDocument from './controller/adminExtractDocument';
import adminGetDashboardMetrics from './controller/adminGetDashboardMetrics';
import adminGetDocumentCompliance from './controller/adminGetDocumentCompliance';
import adminGetHillebrandEvents from './controller/adminGetHillebrandEvents';
import adminGetLandedCostReport from './controller/adminGetLandedCostReport';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminGetQuote from './controller/adminGetQuote';
import adminGetQuotes from './controller/adminGetQuotes';
import adminGetReportMetrics from './controller/adminGetReportMetrics';
import adminRejectQuote from './controller/adminRejectQuote';
import adminRemoveItem from './controller/adminRemoveItem';
import adminSyncHillebrand from './controller/adminSyncHillebrand';
import adminSyncHillebrandDocuments from './controller/adminSyncHillebrandDocuments';
import adminSyncHillebrandInvoices from './controller/adminSyncHillebrandInvoices';
import adminUpdate from './controller/adminUpdate';
import adminUpdateQuote from './controller/adminUpdateQuote';
import adminUpdateStatus from './controller/adminUpdateStatus';
import adminUploadDocument from './controller/adminUploadDocument';
import partnerGetMany from './controller/partnerGetMany';
import partnerGetOne from './controller/partnerGetOne';
import partnerUploadDocument from './controller/partnerUploadDocument';

const adminRouter = createTRPCRouter({
  // Dashboard
  getDashboardMetrics: adminGetDashboardMetrics,

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

  // Tools
  extractDocument: adminExtractDocument,

  // Quotes
  quotes: createTRPCRouter({
    create: adminCreateQuote,
    update: adminUpdateQuote,
    getMany: adminGetQuotes,
    getOne: adminGetQuote,
    accept: adminAcceptQuote,
    reject: adminRejectQuote,
    compare: adminCompareQuotes,
  }),
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
