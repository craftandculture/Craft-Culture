import { z } from 'zod';

/**
 * Schema for querying agent outputs with pagination
 */
const getAgentOutputsSchema = z.object({
  agentId: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
});

export default getAgentOutputsSchema;
