/**
 * Development-only logging utility
 *
 * Debug output only in development. Warnings, info and errors are always
 * logged: a warning dropped in production is a problem nobody hears about.
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
   * Log warnings (always logged)
   */
  warn: (...args: unknown[]) => {
    console.warn(...args);
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
