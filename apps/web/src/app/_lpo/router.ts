import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCreateZohoOrder from './controller/adminCreateZohoOrder';
import adminPreviewLpo from './controller/adminPreviewLpo';
import adminSearchZohoCustomers from './controller/adminSearchZohoCustomers';

const lpoRouter = createTRPCRouter({
  admin: createTRPCRouter({
    preview: adminPreviewLpo,
    // Who the order is for, chosen from Zoho rather than read off the document
    zohoCustomers: adminSearchZohoCustomers,
    // The draft order the preview has already worked out
    createZohoOrder: adminCreateZohoOrder,
  }),
});

export default lpoRouter;
