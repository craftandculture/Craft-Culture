import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminPreviewLpo from './controller/adminPreviewLpo';

const lpoRouter = createTRPCRouter({
  admin: createTRPCRouter({
    preview: adminPreviewLpo,
  }),
});

export default lpoRouter;
