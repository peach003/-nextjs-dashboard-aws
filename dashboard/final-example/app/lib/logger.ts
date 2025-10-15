/**
 * Structured Logging with Pino
 *
 * Provides structured, JSON-based logging for the application.
 * Logs are sent to CloudWatch in production and formatted nicely in development.
 *
 * Usage:
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Database error', { error: err });
 *   logger.debug('Query executed', { query: 'SELECT *' });
 */

import pino from 'pino';

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Create logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
    app: 'nextjs-dashboard',
    stage: process.env.SST_STAGE || 'local',
  },

  // Format timestamps
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty print in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Production serializers
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log request/response
 */
export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
) {
  logger.info({
    msg: 'HTTP Request',
    method,
    url,
    statusCode,
    duration,
    type: 'http',
  });
}

/**
 * Log database query
 */
export function logQuery(query: string, duration: number, rowCount?: number) {
  logger.debug({
    msg: 'Database Query',
    query: query.substring(0, 100), // Truncate long queries
    duration,
    rowCount,
    type: 'database',
  });
}

/**
 * Log authentication event
 */
export function logAuth(
  event: 'login' | 'logout' | 'register' | 'failed',
  userId?: string,
  email?: string,
) {
  logger.info({
    msg: `Auth: ${event}`,
    event,
    userId,
    email,
    type: 'auth',
  });
}

/**
 * Log error with context
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>,
) {
  logger.error({
    msg: error.message,
    error,
    ...context,
    type: 'error',
  });
}

// Export default logger
export default logger;
