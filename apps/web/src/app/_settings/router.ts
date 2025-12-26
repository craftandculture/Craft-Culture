import { createTRPCRouter } from '@/lib/trpc/trpc';

import logoRemove from './controller/logoRemove';
import logoUpload from './controller/logoUpload';
import personalDetailsUpdate from './controller/personalDetailsUpdate';
import settingsGet from './controller/settingsGet';
import settingsUpdate from './controller/settingsUpdate';

const settingsRouter = createTRPCRouter({
  get: settingsGet,
  update: settingsUpdate,
  updatePersonalDetails: personalDetailsUpdate,
  uploadLogo: logoUpload,
  removeLogo: logoRemove,
});

export default settingsRouter;
