/**
 * Custom CloudWatch Metrics
 *
 * Sends custom application metrics to CloudWatch for monitoring and alerting.
 * Only enabled in AWS environments (staging/production).
 *
 * Usage:
 *   await metrics.incrementCounter('user.login');
 *   await metrics.recordValue('api.latency', 245);
 *   await metrics.recordValue('db.query.duration', 123);
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

// CloudWatch client (only initialized in AWS)
let cloudwatch: CloudWatchClient | null = null;

// Only enable metrics in AWS environments
const isAWS = process.env.AWS_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME;
const namespace = 'NextjsDashboard';

if (isAWS) {
  cloudwatch = new CloudWatchClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
}

/**
 * Send metric to CloudWatch
 */
async function putMetric(
  metricName: string,
  value: number,
  unit: string = 'Count',
  dimensions?: Record<string, string>,
) {
  // Skip if not in AWS
  if (!cloudwatch) {
    logger.debug(`Metric (local): ${metricName} = ${value}`);
    return;
  }

  try {
    const metricData: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions
        ? Object.entries(dimensions).map(([Name, Value]) => ({
            Name,
            Value,
          }))
        : undefined,
    };

    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [metricData],
      }),
    );

    logger.debug(`Metric sent: ${metricName} = ${value}`);
  } catch (error) {
    logger.error('Failed to send metric', { error, metricName });
  }
}

/**
 * Increment a counter metric
 */
export async function incrementCounter(
  metricName: string,
  dimensions?: Record<string, string>,
) {
  await putMetric(metricName, 1, 'Count', dimensions);
}

/**
 * Record a value metric
 */
export async function recordValue(
  metricName: string,
  value: number,
  unit: string = 'None',
  dimensions?: Record<string, string>,
) {
  await putMetric(metricName, value, unit, dimensions);
}

/**
 * Record duration in milliseconds
 */
export async function recordDuration(
  metricName: string,
  durationMs: number,
  dimensions?: Record<string, string>,
) {
  await putMetric(metricName, durationMs, 'Milliseconds', dimensions);
}

/**
 * Measure function execution time and send as metric
 */
export async function measureAsync<T>(
  metricName: string,
  fn: () => Promise<T>,
  dimensions?: Record<string, string>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await recordDuration(metricName, duration, dimensions);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    await recordDuration(metricName, duration, {
      ...dimensions,
      status: 'error',
    });
    throw error;
  }
}

/**
 * Common application metrics
 */
export const metrics = {
  // User metrics
  userLogin: () => incrementCounter('User.Login'),
  userLogout: () => incrementCounter('User.Logout'),
  userLoginFailed: () => incrementCounter('User.LoginFailed'),

  // Invoice metrics
  invoiceCreated: () => incrementCounter('Invoice.Created'),
  invoiceUpdated: () => incrementCounter('Invoice.Updated'),
  invoiceDeleted: () => incrementCounter('Invoice.Deleted'),

  // Database metrics
  dbQueryDuration: (duration: number) =>
    recordDuration('Database.QueryDuration', duration),
  dbQueryError: () => incrementCounter('Database.QueryError'),

  // API metrics
  apiRequest: (path: string, statusCode: number) =>
    incrementCounter('API.Request', { path, status: String(statusCode) }),
  apiLatency: (path: string, duration: number) =>
    recordDuration('API.Latency', duration, { path }),

  // Error metrics
  errorCount: (type: string) =>
    incrementCounter('Application.Error', { type }),
};

export default metrics;
