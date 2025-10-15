/**
 * Database Stack - RDS Aurora Serverless PostgreSQL
 *
 * Creates a serverless PostgreSQL database using RDS Aurora v2.
 * Features:
 * - Auto-scaling from 0.5 to 4 ACU (Aurora Capacity Units)
 * - Automatic pause after 5 minutes of inactivity (staging only)
 * - Multi-AZ for production
 * - Automated backups with 7-day retention
 * - Encryption at rest
 * - Secrets Manager for credentials
 */

export function createDatabase() {
  const stage = $app.stage;

  // Create VPC for database
  const vpc = new sst.aws.Vpc("DashboardVpc", {
    nat: stage === "production" ? "managed" : "ec2", // Use EC2 NAT for staging to save costs
  });

  // Create RDS Aurora Serverless v2 PostgreSQL cluster
  const database = new sst.aws.Postgres("DashboardDB", {
    vpc,
    engine: "aurora-postgresql",
    version: "15.5",
    scaling: {
      min: stage === "production" ? "1 ACU" : "0.5 ACU",
      max: stage === "production" ? "4 ACU" : "2 ACU",
    },
    // Enable auto-pause for staging to save costs
    autoPause: stage === "production" ? false : "5 minutes",
    transform: {
      cluster: (args) => {
        args.backupRetentionPeriod = stage === "production" ? 14 : 7;
        args.preferredBackupWindow = "03:00-04:00"; // 3-4 AM UTC
        args.preferredMaintenanceWindow = "sun:04:00-sun:05:00"; // Sunday 4-5 AM UTC
        args.enableHttpEndpoint = true; // Enable Data API
        args.storageEncrypted = true;
        args.deletionProtection = stage === "production";

        // Production: Multi-AZ for high availability
        if (stage === "production") {
          args.availabilityZones = ["us-east-1a", "us-east-1b"];
        }
      },
      instance: (args) => {
        args.publiclyAccessible = false; // Keep database private
        args.performanceInsightsEnabled = stage === "production";
      },
    },
  });

  // Create Security Group for Lambda -> Database access
  const dbSecurityGroup = new sst.aws.SecurityGroup("DatabaseAccess", {
    vpc,
    ingress: [
      {
        fromPort: 5432,
        toPort: 5432,
        protocol: "tcp",
        cidrBlocks: [vpc.privateSubnets[0].cidrBlock],
        description: "Allow PostgreSQL access from Lambda functions",
      },
    ],
  });

  return {
    cluster: database,
    vpc,
    securityGroup: dbSecurityGroup,
    // Connection properties for environment variables
    url: $interpolate`postgresql://${database.username}:${database.password}@${database.host}:${database.port}/${database.database}?sslmode=require`,
    directUrl: $interpolate`postgresql://${database.username}:${database.password}@${database.host}:${database.port}/${database.database}?sslmode=require&connection_limit=1`,
    host: database.host,
    port: database.port,
    database: database.database,
    username: database.username,
    password: database.password,
  };
}
