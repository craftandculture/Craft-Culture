import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCreateZohoOrder from './controller/adminCreateZohoOrder';
import adminPreviewLpo from './controller/adminPreviewLpo';

const lpoRouter = createTRPCRouter({
  admin: createTRPCRouter({
    preview: adminPreviewLpo,
    // The draft order the preview has already worked out
    createZohoOrder: adminCreateZohoOrder,
  }),
});

export default lpoRouter;
