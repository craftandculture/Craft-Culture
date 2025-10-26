import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import logger from './logger';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  describe('dev', () => {
    it('should log in development mode', () => {
      process.env.NODE_ENV = 'development';
      logger.dev('test message');
      expect(console.log).toHaveBeenCalledWith('test message');
    });

    it('should not log in production mode', () => {
      process.env.NODE_ENV = 'production';
      logger.dev('test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log in test mode', () => {
      process.env.NODE_ENV = 'test';
      logger.dev('test message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should warn in development mode', () => {
      process.env.NODE_ENV = 'development';
      logger.warn('warning message');
      expect(console.warn).toHaveBeenCalledWith('warning message');
    });

    it('should not warn in production mode', () => {
      process.env.NODE_ENV = 'production';
      logger.warn('warning message');
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should always log errors in development', () => {
      process.env.NODE_ENV = 'development';
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });

    it('should always log errors in production', () => {
      process.env.NODE_ENV = 'production';
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });

    it('should always log errors in test', () => {
      process.env.NODE_ENV = 'test';
      logger.error('error message');
      expect(console.error).toHaveBeenCalledWith('error message');
    });
  });
});
