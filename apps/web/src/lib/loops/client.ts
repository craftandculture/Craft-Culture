import { LoopsClient } from 'loops';

import serverConfig from '@/server.config';

import createMockLoopsClient from './mockClient';

/**
 * Loops email client
 *
 * In development mode, uses a mock client that logs emails to console
 * In production/preview, uses the real Loops API
 */
const loops: LoopsClient =
  serverConfig.env === 'development'
    ? (createMockLoopsClient() as unknown as LoopsClient)
    : new LoopsClient(serverConfig.loopsApiKey);

export default loops;
