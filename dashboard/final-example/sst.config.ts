/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */

/**
 * SST Configuration for Next.js Dashboard
 *
 * This configuration defines the infrastructure for deploying the Next.js
 * Dashboard application to AWS using SST v3 Ion and OpenNext.
 *
 * Architecture:
 * - Next.js app deployed as serverless Lambda functions (via OpenNext)
 * - Static assets served from S3 + CloudFront CDN
 * - PostgreSQL database (using Neon initially, can migrate to RDS later)
 * - Environment variables managed securely
 * - CloudWatch monitoring and logging
 *
 * Deployment stages:
 * - staging: Lower resources, for testing
 * - prod: Production-ready with higher capacity
 */

export default $config({
  app(input) {
    return {
      name: "nextjs-dashboard",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-2",
        },
      },
    };
  },
  async run() {
    // For Phase 2, we'll use Neon database (already configured)
    // In Phase 5, we can migrate to RDS Aurora if needed

    // Create the Next.js site with SST's built-in OpenNext integration
    const site = new sst.aws.Nextjs("NextjsDashboard", {
      path: "./",

      // Environment variables (use your existing Neon database)
      environment: {
        POSTGRES_URL: process.env.POSTGRES_URL || "",
        POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL || "",
        POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING || "",
        POSTGRES_USER: process.env.POSTGRES_USER || "",
        POSTGRES_HOST: process.env.POSTGRES_HOST || "",
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "",
        POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || "",
        AUTH_SECRET: process.env.AUTH_SECRET || "",
        AUTH_URL: process.env.AUTH_URL || "",
      },

      // Custom domain (optional, configure after deployment)
      domain: $app.stage === "production"
        ? undefined  // Set this to your domain later: "dashboard.yourdomain.com"
        : undefined,

      // Lambda configuration
      server: {
        memory: $app.stage === "production" ? "2048 MB" : "1024 MB",
      },
    });

    // Output the site URL
    return {
      url: site.url,
      stage: $app.stage,
    };
  },
});
