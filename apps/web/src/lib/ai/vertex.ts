import { createVertex } from '@ai-sdk/google-vertex';

import serverConfig from '@/server.config';

const vertex = createVertex({
  project: serverConfig.vertexProject,
  location: serverConfig.vertexLocation,
  googleAuthOptions: {
    credentials: serverConfig.googleCloudCredentials,
  },
});

export default vertex;
