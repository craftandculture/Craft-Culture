import { LoopsClient } from 'loops';

import serverConfig from '@/server.config';

const loops = new LoopsClient(serverConfig.loopsApiKey);

export default loops;
