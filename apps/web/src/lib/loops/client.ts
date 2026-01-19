import { LoopsClient } from 'loops';

import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import createMockLoopsClient from './mockClient';

let cachedClient: LoopsClient | null = null;

/**
 * Get the Loops email client
 * Uses lazy initialization to avoid build-time errors
 */
const getLoopsClient = (): LoopsClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const useMock = serverConfig.env === 'development' || !serverConfig.loopsApiKey;

  logger.info('Loops client initialization', {
    env: serverConfig.env,
    hasApiKey: !!serverConfig.loopsApiKey,
    useMock,
  });

  if (useMock) {
    logger.warn('Using MOCK Loops client - emails will NOT be sent');
    cachedClient = createMockLoopsClient() as unknown as LoopsClient;
  } else {
    logger.info('Using REAL Loops client');
    cachedClient = new LoopsClient(serverConfig.loopsApiKey);
  }

  return cachedClient;
};

/**
 * Loops email client
 *
 * In development mode (or during build), uses a mock client that logs to console
 * In production/preview, uses the real Loops API
 *
 * Uses lazy initialization to avoid build-time API key errors
 */
const loops = new Proxy({} as LoopsClient, {
  get(_target, prop: keyof LoopsClient) {
    const client = getLoopsClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default loops;
