import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDashboard from './controller/admin/adminDashboard';
import adminSupplierApprove from './controller/admin/adminSupplierApprove';
import adminSuppliersList from './controller/admin/adminSuppliersList';
import catalogList from './controller/catalog/catalogList';
import catalogSearch from './controller/catalog/catalogSearch';
import catalogWineDetail from './controller/catalog/catalogWineDetail';
import supplierDashboard from './controller/supplier/supplierDashboard';
import supplierInventoryList from './controller/supplier/supplierInventoryList';
import supplierPayoutsList from './controller/supplier/supplierPayoutsList';
import supplierSalesList from './controller/supplier/supplierSalesList';
import supplierShipmentsList from './controller/supplier/supplierShipmentsList';

/**
 * Wine Exchange router
 *
 * Sub-routers for supplier portal, trade catalog, and admin management.
 * B2B marketplace connecting European wine suppliers with UAE trade buyers.
 */
const exchangeRouter = createTRPCRouter({
  // Supplier Portal
  supplier: createTRPCRouter({
    dashboard: supplierDashboard,
    inventoryList: supplierInventoryList,
    salesList: supplierSalesList,
    shipmentsList: supplierShipmentsList,
    payoutsList: supplierPayoutsList,
  }),

  // Trade Catalog (accessible to all authenticated partners)
  catalog: createTRPCRouter({
    list: catalogList,
    search: catalogSearch,
    wine: catalogWineDetail,
  }),

  // Admin Management
  admin: createTRPCRouter({
    dashboard: adminDashboard,
    suppliersList: adminSuppliersList,
    supplierApprove: adminSupplierApprove,
  }),
});

export default exchangeRouter;
