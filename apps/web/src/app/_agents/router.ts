import { createTRPCRouter } from '@/lib/trpc/trpc';

import getAgentOutputs from './controllers/getAgentOutputs';
import getCompetitorWines from './controllers/getCompetitorWines';
import getLatestBrief from './controllers/getLatestBrief';
import triggerAgent from './controllers/triggerAgent';
import uploadCompetitorList from './controllers/uploadCompetitorList';

const agentsRouter = createTRPCRouter({
  getAgentOutputs,
  getCompetitorWines,
  getLatestBrief,
  triggerAgent,
  uploadCompetitorList,
});

export default agentsRouter;
