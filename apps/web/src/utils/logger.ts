/**
 * Development-only logging utility
 *
 * Provides conditional logging that only outputs in development mode.
 * Errors are always logged regardless of environment.
 *
 * @example
 *   logger.dev('Debug info', { data });
 *   logger.warn('Warning message');
 *   logger.error('Error occurred', error);
 */
const logger = {
  /**
   * Log debug information (development only)
   */
  dev: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },

  /**
   * Log warnings (development only)
   */
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },

  /**
   * Log informational messages (always logged)
   */
  info: (...args: unknown[]) => {
    console.log(...args);
  },

  /**
   * Log errors (always logged)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

export default logger;
