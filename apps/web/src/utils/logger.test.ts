import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import logger from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('dev', () => {
    it('should log in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.dev('test message');
      expect(console.log).toHaveBeenCalledWith('test message');
    });

    it('should not log in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.dev('test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log in test mode', () => {
      vi.stubEnv('NODE_ENV', 'test');
      logger.dev('test message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should warn in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.warn('warning message');
      expect(console.warn).toHaveBeenCalledWith('warning message');
    });

    it('should not warn in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.warn('warning message');
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should always log errors in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });

    it('should always log errors in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });

    it('should always log errors in test', () => {
      vi.stubEnv('NODE_ENV', 'test');
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });
  });
});
