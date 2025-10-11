import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import serverConfig from '@/server.config';

const openrouter = createOpenRouter({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: serverConfig.openrouterApiKey,
  compatibility: 'strict',
});

export default openrouter;
