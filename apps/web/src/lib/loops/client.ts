import { LoopsClient } from 'loops';

import serverConfig from '@/server.config';

import createMockLoopsClient from './mockClient';

/**
 * Loops email client
 *
 * In development mode, uses a mock client that logs emails to console
 * In production/preview, uses the real Loops API
 */
const loops: Pick<LoopsClient, 'sendTransactionalEmail'> | LoopsClient =
  serverConfig.env === 'development'
    ? createMockLoopsClient()
    : new LoopsClient(serverConfig.loopsApiKey);

export default loops;
