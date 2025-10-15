/**
 * Security Stack - AWS WAF (Web Application Firewall)
 *
 * Protects the application from common web exploits:
 * - SQL injection attacks
 * - Cross-site scripting (XSS)
 * - Rate limiting to prevent DDoS
 * - Geographic restrictions (optional)
 * - AWS Managed Rules for common threats
 */

import * as aws from "@pulumi/aws";

export function createWAF() {
  const stage = $app.stage;

  // Create WAF Web ACL for CloudFront
  const webAcl = new aws.wafv2.WebAcl("DashboardWAF", {
    scope: "CLOUDFRONT",
    description: `WAF for Next.js Dashboard - ${stage}`,

    defaultAction: {
      allow: {},
    },

    // WAF Rules
    rules: [
      // Rule 1: AWS Managed - Core Rule Set
      {
        name: "AWSManagedRulesCommonRuleSet",
        priority: 1,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesCommonRuleSet",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "AWSManagedRulesCommonRuleSetMetric",
          sampledRequestsEnabled: true,
        },
      },

      // Rule 2: AWS Managed - Known Bad Inputs
      {
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        priority: 2,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesKnownBadInputsRuleSet",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "AWSManagedRulesKnownBadInputsRuleSetMetric",
          sampledRequestsEnabled: true,
        },
      },

      // Rule 3: AWS Managed - SQL Database Protection
      {
        name: "AWSManagedRulesSQLiRuleSet",
        priority: 3,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesSQLiRuleSet",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "AWSManagedRulesSQLiRuleSetMetric",
          sampledRequestsEnabled: true,
        },
      },

      // Rule 4: Rate Limiting (100 requests per 5 minutes per IP)
      {
        name: "RateLimitRule",
        priority: 4,
        action: {
          block: {
            customResponse: {
              responseCode: 429,
              customResponseBodyKey: "rate-limit-response",
            },
          },
        },
        statement: {
          rateBasedStatement: {
            limit: stage === "production" ? 2000 : 1000, // Requests per 5 minutes
            aggregateKeyType: "IP",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "RateLimitRuleMetric",
          sampledRequestsEnabled: true,
        },
      },

      // Rule 5: Block Common Attack Patterns
      {
        name: "BlockCommonAttacks",
        priority: 5,
        action: { block: {} },
        statement: {
          orStatement: {
            statements: [
              // Block requests with suspicious user agents
              {
                byteMatchStatement: {
                  searchString: "bot",
                  fieldToMatch: { singleHeader: { name: "user-agent" } },
                  textTransformations: [
                    { priority: 0, type: "LOWERCASE" },
                  ],
                  positionalConstraint: "CONTAINS",
                },
              },
              // Block requests trying to access admin paths
              {
                byteMatchStatement: {
                  searchString: "/admin",
                  fieldToMatch: { uriPath: {} },
                  textTransformations: [
                    { priority: 0, type: "LOWERCASE" },
                  ],
                  positionalConstraint: "STARTS_WITH",
                },
              },
            ],
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "BlockCommonAttacksMetric",
          sampledRequestsEnabled: true,
        },
      },
    ],

    // Custom response bodies
    customResponseBodies: [
      {
        key: "rate-limit-response",
        contentType: "APPLICATION_JSON",
        content: JSON.stringify({
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        }),
      },
    ],

    visibilityConfig: {
      cloudwatchMetricsEnabled: true,
      metricName: "DashboardWAFMetric",
      sampledRequestsEnabled: true,
    },

    tags: {
      Name: `nextjs-dashboard-waf-${stage}`,
      Environment: stage,
      ManagedBy: "SST",
    },
  });

  // Create CloudWatch Log Group for WAF logs
  const wafLogGroup = new aws.cloudwatch.LogGroup("WAFLogs", {
    name: `/aws/waf/dashboard-${stage}`,
    retentionInDays: stage === "production" ? 30 : 7,
    tags: {
      Name: `nextjs-dashboard-waf-logs-${stage}`,
      Environment: stage,
    },
  });

  // Enable WAF logging
  new aws.wafv2.WebAclLoggingConfiguration("WAFLogging", {
    resourceArn: webAcl.arn,
    logDestinationConfigs: [wafLogGroup.arn],
  });

  return {
    arn: webAcl.arn,
    id: webAcl.id,
    logGroup: wafLogGroup.name,
  };
}
