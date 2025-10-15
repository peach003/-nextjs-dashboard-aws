/**
 * Monitoring Stack - CloudWatch Dashboards and Alarms
 *
 * Creates comprehensive monitoring for the application:
 * - CloudWatch Dashboard with key metrics
 * - Alarms for errors, latency, and database issues
 * - SNS topics for notifications
 * - Custom metrics for application monitoring
 */

import * as aws from "@pulumi/aws";

export function createMonitoring(site: any, database: any) {
  const stage = $app.stage;

  // Create SNS topic for alerts
  const alertTopic = new aws.sns.Topic("DashboardAlerts", {
    name: `nextjs-dashboard-alerts-${stage}`,
    displayName: `Next.js Dashboard Alerts - ${stage}`,
    tags: {
      Name: `nextjs-dashboard-alerts-${stage}`,
      Environment: stage,
    },
  });

  // SNS topic subscription (add email after deployment)
  // To subscribe: aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint your@email.com

  // Create CloudWatch Dashboard
  const dashboard = new aws.cloudwatch.Dashboard("DashboardMetrics", {
    dashboardName: `nextjs-dashboard-${stage}`,
    dashboardBody: JSON.stringify({
      widgets: [
        // Lambda Invocations
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/Lambda", "Invocations", { stat: "Sum" }],
              [".", "Errors", { stat: "Sum" }],
              [".", "Throttles", { stat: "Sum" }],
            ],
            period: 300,
            stat: "Sum",
            region: "us-east-1",
            title: "Lambda Metrics",
            yAxis: { left: { min: 0 } },
          },
        },

        // Lambda Duration
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/Lambda", "Duration", { stat: "Average" }],
              ["...", { stat: "p99" }],
            ],
            period: 300,
            stat: "Average",
            region: "us-east-1",
            title: "Lambda Duration",
            yAxis: { left: { min: 0 } },
          },
        },

        // CloudFront Requests
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/CloudFront", "Requests", { stat: "Sum" }],
              [".", "4xxErrorRate", { stat: "Average" }],
              [".", "5xxErrorRate", { stat: "Average" }],
            ],
            period: 300,
            stat: "Sum",
            region: "us-east-1",
            title: "CloudFront Metrics",
            yAxis: { left: { min: 0 } },
          },
        },

        // Database Connections
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/RDS", "DatabaseConnections", { stat: "Average" }],
              [".", "CPUUtilization", { stat: "Average" }],
            ],
            period: 300,
            stat: "Average",
            region: "us-east-1",
            title: "Database Metrics",
            yAxis: { left: { min: 0 } },
          },
        },

        // WAF Blocked Requests
        {
          type: "metric",
          properties: {
            metrics: [["AWS/WAFV2", "BlockedRequests", { stat: "Sum" }]],
            period: 300,
            stat: "Sum",
            region: "us-east-1",
            title: "WAF Blocked Requests",
            yAxis: { left: { min: 0 } },
          },
        },

        // Estimated Costs (requires Cost Explorer)
        {
          type: "metric",
          properties: {
            metrics: [["AWS/Billing", "EstimatedCharges", { stat: "Maximum" }]],
            period: 86400, // 1 day
            stat: "Maximum",
            region: "us-east-1",
            title: "Estimated Daily Costs",
            yAxis: { left: { min: 0 } },
          },
        },
      ],
    }),
  });

  // CloudWatch Alarm: Lambda Errors
  const lambdaErrorAlarm = new aws.cloudwatch.MetricAlarm("LambdaErrorAlarm", {
    name: `dashboard-lambda-errors-${stage}`,
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "Errors",
    namespace: "AWS/Lambda",
    period: 300,
    statistic: "Sum",
    threshold: stage === "production" ? 10 : 20,
    alarmDescription: "Alert when Lambda functions have errors",
    alarmActions: [alertTopic.arn],
    tags: {
      Environment: stage,
    },
  });

  // CloudWatch Alarm: Lambda Throttles
  const lambdaThrottleAlarm = new aws.cloudwatch.MetricAlarm(
    "LambdaThrottleAlarm",
    {
      name: `dashboard-lambda-throttles-${stage}`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1,
      metricName: "Throttles",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Sum",
      threshold: 5,
      alarmDescription: "Alert when Lambda functions are throttled",
      alarmActions: [alertTopic.arn],
      tags: {
        Environment: stage,
      },
    }
  );

  // CloudWatch Alarm: High Lambda Duration
  const lambdaDurationAlarm = new aws.cloudwatch.MetricAlarm(
    "LambdaDurationAlarm",
    {
      name: `dashboard-lambda-duration-${stage}`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "Duration",
      namespace: "AWS/Lambda",
      period: 300,
      statistic: "Average",
      threshold: 5000, // 5 seconds
      alarmDescription: "Alert when Lambda duration is too high",
      alarmActions: [alertTopic.arn],
      tags: {
        Environment: stage,
      },
    }
  );

  // CloudWatch Alarm: CloudFront 5xx Errors
  const cloudfrontErrorAlarm = new aws.cloudwatch.MetricAlarm(
    "CloudFront5xxAlarm",
    {
      name: `dashboard-cloudfront-5xx-${stage}`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "5xxErrorRate",
      namespace: "AWS/CloudFront",
      period: 300,
      statistic: "Average",
      threshold: stage === "production" ? 1 : 5, // Percentage
      alarmDescription: "Alert when CloudFront has high 5xx error rate",
      alarmActions: [alertTopic.arn],
      tags: {
        Environment: stage,
      },
    }
  );

  // CloudWatch Alarm: Database CPU
  const databaseCpuAlarm = new aws.cloudwatch.MetricAlarm("DatabaseCPUAlarm", {
    name: `dashboard-database-cpu-${stage}`,
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/RDS",
    period: 300,
    statistic: "Average",
    threshold: 80, // 80%
    alarmDescription: "Alert when database CPU is high",
    alarmActions: [alertTopic.arn],
    tags: {
      Environment: stage,
    },
  });

  // CloudWatch Alarm: High Database Connections
  const databaseConnectionAlarm = new aws.cloudwatch.MetricAlarm(
    "DatabaseConnectionAlarm",
    {
      name: `dashboard-database-connections-${stage}`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2,
      metricName: "DatabaseConnections",
      namespace: "AWS/RDS",
      period: 300,
      statistic: "Average",
      threshold: 80, // Adjust based on your max connections
      alarmDescription: "Alert when database connections are high",
      alarmActions: [alertTopic.arn],
      tags: {
        Environment: stage,
      },
    }
  );

  // CloudWatch Alarm: Cost threshold
  if (stage === "production") {
    const costAlarm = new aws.cloudwatch.MetricAlarm("CostAlarm", {
      name: `dashboard-cost-alert-${stage}`,
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1,
      metricName: "EstimatedCharges",
      namespace: "AWS/Billing",
      period: 86400, // 1 day
      statistic: "Maximum",
      threshold: 100, // Alert if estimated monthly cost exceeds $100
      alarmDescription: "Alert when estimated costs are high",
      alarmActions: [alertTopic.arn],
      tags: {
        Environment: stage,
      },
    });
  }

  // Create Log Group for application logs
  const appLogGroup = new aws.cloudwatch.LogGroup("ApplicationLogs", {
    name: `/aws/nextjs-dashboard/${stage}`,
    retentionInDays: stage === "production" ? 30 : 7,
    tags: {
      Name: `nextjs-dashboard-logs-${stage}`,
      Environment: stage,
    },
  });

  return {
    dashboard: dashboard.dashboardName,
    alertTopic: alertTopic.arn,
    logGroup: appLogGroup.name,
    alarms: {
      lambdaErrors: lambdaErrorAlarm.name,
      lambdaThrottles: lambdaThrottleAlarm.name,
      lambdaDuration: lambdaDurationAlarm.name,
      cloudfrontErrors: cloudfrontErrorAlarm.name,
      databaseCpu: databaseCpuAlarm.name,
      databaseConnections: databaseConnectionAlarm.name,
    },
  };
}
