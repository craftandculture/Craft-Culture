import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAcceptQuote from './controller/adminAcceptQuote';
import adminAddItem from './controller/adminAddItem';
import adminAssignQuoteRequest from './controller/adminAssignQuoteRequest';
import adminCalculateLandedCost from './controller/adminCalculateLandedCost';
import adminCompareQuotes from './controller/adminCompareQuotes';
import adminCreate from './controller/adminCreate';
import adminCreateQuote from './controller/adminCreateQuote';
import adminCreateQuoteRequest from './controller/adminCreateQuoteRequest';
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
import adminGetQuoteRequest from './controller/adminGetQuoteRequest';
import adminGetQuoteRequests from './controller/adminGetQuoteRequests';
import adminGetQuotes from './controller/adminGetQuotes';
import adminGetReportMetrics from './controller/adminGetReportMetrics';
import adminImportExtractedItems from './controller/adminImportExtractedItems';
import adminRejectQuote from './controller/adminRejectQuote';
import adminRemoveItem from './controller/adminRemoveItem';
import adminSyncHillebrand from './controller/adminSyncHillebrand';
import adminSyncHillebrandDocuments from './controller/adminSyncHillebrandDocuments';
import adminSyncHillebrandInvoices from './controller/adminSyncHillebrandInvoices';
import adminUpdate from './controller/adminUpdate';
import adminUpdateQuote from './controller/adminUpdateQuote';
import adminUpdateQuoteRequest from './controller/adminUpdateQuoteRequest';
import adminUpdateStatus from './controller/adminUpdateStatus';
import adminUploadDocument from './controller/adminUploadDocument';
import adminUploadQuoteRequestAttachment from './controller/adminUploadQuoteRequestAttachment';
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
  importExtractedItems: adminImportExtractedItems,

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

  // Quote Requests
  requests: createTRPCRouter({
    create: adminCreateQuoteRequest,
    update: adminUpdateQuoteRequest,
    getMany: adminGetQuoteRequests,
    getOne: adminGetQuoteRequest,
    assign: adminAssignQuoteRequest,
    uploadAttachment: adminUploadQuoteRequestAttachment,
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
