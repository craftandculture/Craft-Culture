import { createTRPCRouter } from '@/lib/trpc/trpc';

import getAgentOutputs from './controllers/getAgentOutputs';
import getCompetitorWines from './controllers/getCompetitorWines';
import getLatestBrief from './controllers/getLatestBrief';
import uploadCompetitorList from './controllers/uploadCompetitorList';

const agentsRouter = createTRPCRouter({
  getAgentOutputs,
  getCompetitorWines,
  getLatestBrief,
  uploadCompetitorList,
});

export default agentsRouter;
