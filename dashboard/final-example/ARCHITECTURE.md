# Architecture Documentation

Detailed technical architecture for the Next.js Dashboard AWS deployment.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Details](#component-details)
3. [Data Flow](#data-flow)
4. [Authentication Flow](#authentication-flow)
5. [Deployment Architecture](#deployment-architecture)
6. [Database Architecture](#database-architecture)
7. [Monitoring & Observability](#monitoring--observability)
8. [Security Architecture](#security-architecture)
9. [Scalability & Performance](#scalability--performance)

---

## System Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              End Users                                  │
│                      (Web Browsers / Mobile)                            │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         CloudFront (CDN)                                │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  - Global Edge Locations (200+ worldwide)                     │     │
│  │  - SSL/TLS Termination                                        │     │
│  │  - DDoS Protection (AWS Shield)                               │     │
│  │  - WAF Integration                                            │     │
│  │  - Response Caching (TTL: 0-86400s)                           │     │
│  └──────────────────────────────────────────────────────────────┘     │
└────────────┬───────────────────────────────────┬───────────────────────┘
             │                                   │
             │ Static Assets                     │ Dynamic Routes
             │ (Cache Hit)                       │ (Cache Miss/SSR)
             ▼                                   ▼
┌────────────────────────┐         ┌────────────────────────────────────┐
│      S3 Bucket         │         │        Lambda Functions            │
│  ┌──────────────────┐  │         │  ┌──────────────────────────────┐  │
│  │ - Images         │  │         │  │ - Next.js SSR               │  │
│  │ - CSS/JS         │  │         │  │ - API Routes                │  │
│  │ - Static HTML    │  │         │  │ - Server Actions            │  │
│  │ - Public files   │  │         │  │ - Middleware                │  │
│  │                  │  │         │  │                             │  │
│  │ Versioning: On   │  │         │  │ Runtime: Node.js 18.x       │  │
│  │ Lifecycle: 90d   │  │         │  │ Memory: 1024-2048 MB        │  │
│  └──────────────────┘  │         │  │ Timeout: 30s                │  │
└────────────────────────┘         │  │ Concurrency: 100 (staging)  │  │
                                   │  │              1000 (prod)    │  │
                                   │  └──────────────┬───────────────┘  │
                                   └─────────────────┼──────────────────┘
                                                     │
                                                     │ SQL Queries
                                                     ▼
                                   ┌─────────────────────────────────────┐
                                   │    RDS Aurora Serverless v2          │
                                   │  ┌───────────────────────────────┐  │
                                   │  │ - PostgreSQL 15.x             │  │
                                   │  │ - Auto-Scaling: 0.5-4 ACU     │  │
                                   │  │ - Multi-AZ: Yes (Prod)        │  │
                                   │  │ - Backup: Daily snapshots     │  │
                                   │  │ - Encryption: AES-256         │  │
                                   │  │ - Connection Pooling: PgBouncer│ │
                                   │  └───────────────────────────────┘  │
                                   └─────────────────────────────────────┘

     Monitoring & Logging Layer
┌─────────────────────────────────────────────────────────────────────────┐
│                         CloudWatch                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │   Log Groups     │  │     Metrics      │  │     Alarms       │     │
│  │  - Lambda logs   │  │  - Invocations   │  │  - Error rate    │     │
│  │  - App logs      │  │  - Duration      │  │  - Latency       │     │
│  │  - Access logs   │  │  - Errors        │  │  - Throttles     │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Deployment Model

**Serverless Architecture Benefits**:
- **Auto-Scaling**: Automatically scales from 0 to thousands of concurrent requests
- **Pay-per-Use**: Only pay for actual compute time and requests
- **High Availability**: Built-in redundancy across multiple AZs
- **Zero Maintenance**: No servers to patch or manage
- **Global Performance**: CloudFront edge caching reduces latency

---

## Component Details

### CloudFront Distribution

**Purpose**: Content Delivery Network (CDN) for global performance and security

**Configuration**:
```yaml
Origins:
  - S3 Bucket (Static assets)
  - Lambda Function URLs (Dynamic routes)

Cache Behaviors:
  - /_next/static/*: Cache for 1 year (immutable)
  - /_next/image/*: Cache for 1 day
  - /api/*: No cache
  - /*: Cache for 0s (SSR), with stale-while-revalidate

Security:
  - TLS 1.2 minimum
  - HTTP to HTTPS redirect
  - Origin Access Identity (S3)
  - WAF Web ACL attached

Performance:
  - Compression: Gzip + Brotli
  - HTTP/2 enabled
  - IPv6 enabled
```

**Edge Locations**: 200+ globally distributed edge locations

### Lambda Functions

**Next.js SSR Functions**:
```
┌─────────────────────────────────────────────────────┐
│  Function: NextjsServer                             │
│  ┌───────────────────────────────────────────────┐  │
│  │ Entry Point: .next/standalone/server.js       │  │
│  │ Layers:                                       │  │
│  │  - Node modules (~50 MB)                      │  │
│  │  - Sharp (image optimization)                 │  │
│  │                                               │  │
│  │ Environment Variables:                        │  │
│  │  - DATABASE_URL (from SSM)                    │  │
│  │  - AUTH_SECRET (from SSM)                     │  │
│  │  - NODE_ENV=production                        │  │
│  │                                               │  │
│  │ Reserved Concurrency:                         │  │
│  │  - Staging: 10                                │  │
│  │  - Production: 100                            │  │
│  │                                               │  │
│  │ Cold Start Optimization:                      │  │
│  │  - Provisioned concurrency: 2 (prod)          │  │
│  │  - Lazy loading for heavy deps                │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**API Route Functions**:
- Separate Lambda per API route (optional optimization)
- Shared connection pooling for database
- Reuse warm containers for performance

**Image Optimization**:
- Lambda@Edge for on-the-fly image resizing
- Sharp library for fast image processing
- Automatic WebP/AVIF conversion

### S3 Bucket

**Structure**:
```
s3://nextjs-dashboard-{stage}/
├── _next/
│   ├── static/
│   │   └── {buildId}/
│   │       ├── chunks/
│   │       ├── css/
│   │       └── media/
│   └── image/
├── public/
│   ├── customers/
│   ├── hero-desktop.png
│   └── hero-mobile.png
└── metadata/
```

**Security**:
- Block public access (CloudFront-only via OAI)
- Encryption at rest (AES-256)
- Versioning enabled
- Lifecycle policies (delete old versions after 90 days)

**Performance**:
- Transfer acceleration enabled
- Intelligent tiering for cost optimization

### Database (RDS Aurora Serverless v2)

**Specifications**:
```yaml
Staging:
  Engine: aurora-postgresql
  Version: 15.5
  Capacity:
    Min: 0.5 ACU (~1 GB RAM)
    Max: 2 ACU (~4 GB RAM)
  Multi-AZ: No
  Backup: 7 days retention
  Maintenance Window: Sun 03:00-04:00 UTC

Production:
  Engine: aurora-postgresql
  Version: 15.5
  Capacity:
    Min: 1 ACU (~2 GB RAM)
    Max: 4 ACU (~8 GB RAM)
  Multi-AZ: Yes (2 AZs)
  Backup: 30 days retention
  Maintenance Window: Sun 03:00-04:00 UTC
  Performance Insights: Enabled
```

**Connection Pooling**:
```javascript
// postgres.js connection
const pool = postgres(DATABASE_URL, {
  max: 20,                    // Max connections per Lambda
  idle_timeout: 20,           // Close idle connections
  connect_timeout: 10,        // Connection timeout
  ssl: { rejectUnauthorized: false }
});
```

**Schema**:
```sql
-- Users table (authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- Stored in cents
  status VARCHAR(20) CHECK (status IN ('pending', 'paid')),
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue table (analytics)
CREATE TABLE revenue (
  month VARCHAR(7) PRIMARY KEY,  -- Format: YYYY-MM
  revenue INTEGER NOT NULL
);

-- Migrations table (tracking)
CREATE TABLE migrations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(date DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## Data Flow

### Request Processing Flow

```
User Request → CloudFront → Lambda → Database → Lambda → CloudFront → User

Detailed Flow:
1. User navigates to /dashboard/invoices
2. Browser sends HTTPS request to CloudFront
3. CloudFront checks cache:
   - Cache HIT: Return cached response (rare for SSR)
   - Cache MISS: Forward to Lambda origin
4. Lambda function:
   - Executes Next.js SSR
   - Runs Server Component
   - Fetches data from database
   - Renders HTML
5. Database query:
   - Lambda → RDS Aurora (via connection pool)
   - Execute SQL query
   - Return results
6. Lambda response:
   - Renders React components with data
   - Returns HTML + hydration data
7. CloudFront:
   - Optionally caches response
   - Returns to user
8. Browser:
   - Displays HTML
   - Hydrates React app
   - Becomes interactive
```

### Write Operation Flow (Server Action)

```
User Form Submit → Client → Server Action → Database → Revalidate → Update UI

Detailed Flow:
1. User submits invoice creation form
2. Form data sent to Server Action (POST /dashboard/invoices/create)
3. Server Action Lambda:
   - Validates input with Zod
   - Checks authentication
4. Database write:
   - INSERT INTO invoices (...)
   - Return new invoice ID
5. Cache revalidation:
   - revalidatePath('/dashboard/invoices')
   - Invalidates CloudFront cache
6. Response:
   - Redirect to /dashboard/invoices
   - Updated data fetched
7. UI updates with new invoice

Error Handling:
- Validation error → Return to form with errors
- Database error → Show error message
- Network error → Retry with exponential backoff
```

### Authentication Flow

```
Login → Credentials Check → Session Creation → Protected Access

Detailed Flow:
1. User visits /login
2. Enters email and password
3. Form submits to authenticate() Server Action
4. Server Action:
   - Queries database for user
   - Compares password with bcrypt.compare()
5. If valid:
   - NextAuth creates session
   - Sets encrypted session cookie
   - Redirects to /dashboard
6. Protected route access:
   - Middleware checks session
   - If valid: Allow access
   - If invalid: Redirect to /login
```

---

## Authentication Flow

### NextAuth.js v5 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Side                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Login Form (/login)                                      │  │
│  │  - Email input                                            │  │
│  │  - Password input                                         │  │
│  │  - Submit → authenticate() Server Action                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ POST /api/auth/callback/credentials
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server Side                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  NextAuth.js API Route                                    │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ 1. Receive credentials                              │  │  │
│  │  │ 2. Call authorize() function                        │  │  │
│  │  │    - Query database for user by email               │  │  │
│  │  │    - Compare password with bcrypt                   │  │  │
│  │  │ 3. If valid:                                        │  │  │
│  │  │    - Create session object                          │  │  │
│  │  │    - Sign JWT token                                 │  │  │
│  │  │    - Set session cookie (encrypted)                 │  │  │
│  │  │ 4. Return session or null                           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ Session Cookie Set
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Middleware                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  On Every Request:                                        │  │
│  │  1. Extract session cookie                               │  │
│  │  2. Verify JWT signature                                 │  │
│  │  3. Check expiration                                     │  │
│  │  4. If valid:                                            │  │
│  │     - Allow access to protected routes                   │  │
│  │     - Populate request.auth with user data               │  │
│  │  5. If invalid:                                          │  │
│  │     - Redirect to /login                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Session Storage:
┌────────────────────────────────────┐
│  Session Cookie (HTTP-only)        │
│  ┌──────────────────────────────┐  │
│  │ Encrypted JWT containing:    │  │
│  │ - User ID                    │  │
│  │ - Email                      │  │
│  │ - Name                       │  │
│  │ - Expiration (30 days)       │  │
│  │ - Signature                  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Security Features**:
- Passwords hashed with bcrypt (10 rounds)
- Session cookies are HTTP-only (not accessible via JavaScript)
- CSRF protection built-in
- Secure cookies in production (HTTPS only)
- Session expiration and renewal
- No password stored in session

---

## Deployment Architecture

### Multi-Environment Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Development (Local)                              │
│  - Database: Neon PostgreSQL (free tier)                                 │
│  - Server: localhost:3001 (Next.js dev server)                           │
│  - Hot reload enabled                                                    │
│  - Source maps enabled                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ git push origin feature-branch
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Pull Request / Feature Branch                         │
│  - GitHub Actions CI/CD:                                                 │
│    - Lint, type-check, format check                                      │
│    - Security scan (Trivy, Snyk)                                         │
│    - Build test                                                          │
│  - No deployment (CI only)                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ merge to main
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Staging Environment                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ AWS Resources:                                                    │  │
│  │ - CloudFormation Stack: nextjs-dashboard-staging                 │  │
│  │ - Lambda: 512-1024 MB                                            │  │
│  │ - Aurora: 0.5-1 ACU                                              │  │
│  │ - CloudFront: staging.example.com                                │  │
│  │                                                                  │  │
│  │ Deployment:                                                      │  │
│  │ - Automatic on push to main                                      │  │
│  │ - Full test suite runs                                           │  │
│  │ - Smoke tests executed                                           │  │
│  │                                                                  │  │
│  │ Purpose:                                                         │  │
│  │ - Integration testing                                            │  │
│  │ - QA validation                                                  │  │
│  │ - Performance testing                                            │  │
│  │ - Stakeholder review                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ manual approval
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Production Environment                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ AWS Resources:                                                    │  │
│  │ - CloudFormation Stack: nextjs-dashboard-prod                    │  │
│  │ - Lambda: 2048 MB, provisioned concurrency: 2                    │  │
│  │ - Aurora: 1-4 ACU, Multi-AZ enabled                              │  │
│  │ - CloudFront: dashboard.example.com                              │  │
│  │                                                                  │  │
│  │ Deployment:                                                      │  │
│  │ - Manual approval required                                       │  │
│  │ - Pre-deployment checklist                                       │  │
│  │ - Post-deployment verification                                   │  │
│  │ - Monitoring for 1 hour                                          │  │
│  │                                                                  │  │
│  │ Protection:                                                      │  │
│  │ - WAF enabled                                                    │  │
│  │ - Rate limiting active                                           │  │
│  │ - Enhanced monitoring                                            │  │
│  │ - Daily backups (30-day retention)                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Infrastructure as Code (SST)

```typescript
// sst.config.ts structure
export default $config({
  app(input) {
    return {
      name: "nextjs-dashboard",
      stage: input.stage,              // staging | prod
      removal: input.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // 1. Create infrastructure stacks
    const database = createDatabase();      // Optional: RDS Aurora
    const security = createWAF();           // Optional: WAF rules
    const monitoring = createDashboard();   // Optional: CloudWatch

    // 2. Deploy Next.js site
    const site = new sst.aws.Nextjs("NextjsDashboard", {
      environment: {
        DATABASE_URL: process.env.POSTGRES_URL,
        AUTH_SECRET: process.env.AUTH_SECRET,
        // ... other env vars
      },
      server: {
        memory: $app.stage === "production" ? "2048 MB" : "1024 MB",
      },
    });

    // 3. Return outputs
    return {
      url: site.url,
      database: database?.endpoint,
    };
  },
});
```

---

## Database Architecture

### Connection Management

```
┌───────────────────────────────────────────────────────────────┐
│                    Lambda Execution Context                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Connection Pool (Global)                               │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ postgres() instance                               │  │  │
│  │  │ - Created outside handler (warm start reuse)      │  │  │
│  │  │ - Max connections: 1 per Lambda container         │  │  │
│  │  │ - Idle timeout: 20s                               │  │  │
│  │  │ - Connection timeout: 10s                         │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Lambda Handler (Invoked per request)                   │  │
│  │  - Reuses pool connection if warm                       │  │
│  │  - Creates new connection if cold                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ Connection pool (max 100 concurrent)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RDS Aurora Cluster                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Connection Limit:                                        │  │
│  │  - Max connections: ~100 (1 ACU) to ~400 (4 ACU)         │  │
│  │  - Reserved for system: ~15                              │  │
│  │  - Available: Scales with ACU                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Best Practices**:
- One connection per Lambda container (reused across invocations)
- Connection pooling at database level (PgBouncer built-in)
- Limit Lambda concurrency to match database capacity
- Monitor `DatabaseConnections` CloudWatch metric

### Data Access Patterns

**Read-Heavy Operations**:
```typescript
// Parallel queries for dashboard
const [
  revenue,
  latestInvoices,
  cardData
] = await Promise.all([
  fetchRevenue(),           // 12 rows
  fetchLatestInvoices(),    // 5 rows with JOIN
  fetchCardData()           // 4 aggregation queries
]);
// Total time: ~50ms (parallel) vs ~150ms (sequential)
```

**Write Operations**:
```typescript
// Server Action with transaction
await sql.begin(async (sql) => {
  // 1. Insert invoice
  const invoice = await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    RETURNING id
  `;

  // 2. Update customer stats (hypothetical)
  await sql`
    UPDATE customers
    SET total_invoices = total_invoices + 1
    WHERE id = ${customerId}
  `;
});
```

**Performance Optimization**:
- Indexes on frequently queried columns
- LIMIT and OFFSET for pagination
- Connection reuse in warm Lambdas
- Query result caching (React Server Components cache)

---

## Monitoring & Observability

### CloudWatch Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Code                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Structured Logging (Pino)                                    │  │
│  │  logger.info({ msg: 'Invoice created', invoiceId, userId })   │  │
│  │  logger.error({ msg: 'DB error', error, query })              │  │
│  │                                                               │  │
│  │  Custom Metrics                                               │  │
│  │  metrics.userLogin()                                          │  │
│  │  metrics.invoiceCreated()                                     │  │
│  │  metrics.dbQueryDuration(150)                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ stdout → CloudWatch Logs
                         │ Metrics API → CloudWatch Metrics
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudWatch                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Log Groups                                                   │  │
│  │  - /aws/lambda/NextjsDashboard-staging                       │  │
│  │  - /aws/lambda/NextjsDashboard-prod                          │  │
│  │  - Retention: 7 days (staging), 30 days (prod)               │  │
│  │  - Log Insights queries for analysis                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Metrics                                                      │  │
│  │  Standard Lambda Metrics:                                    │  │
│  │  - Invocations                                               │  │
│  │  - Errors                                                    │  │
│  │  - Duration (avg, p50, p95, p99)                             │  │
│  │  - Throttles                                                 │  │
│  │  - ConcurrentExecutions                                      │  │
│  │                                                              │  │
│  │  Custom Application Metrics:                                 │  │
│  │  - User.Login (count)                                        │  │
│  │  - Invoice.Created (count)                                   │  │
│  │  - Database.QueryDuration (milliseconds)                     │  │
│  │  - API.Latency (milliseconds)                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Alarms                                                       │  │
│  │  - Lambda error rate > 5%                                    │  │
│  │  - Lambda duration p95 > 1s                                  │  │
│  │  - Database connections > 80%                                │  │
│  │  - 5xx errors > 10/minute                                    │  │
│  │  → SNS Topic → Email/Slack notifications                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Dashboards

**Operational Dashboard** (Real-time):
- Lambda invocations (per minute)
- Error rate percentage
- P95 and P99 latency
- Concurrent executions
- Database connections
- CloudFront cache hit rate

**Business Dashboard** (Analytics):
- User logins (per hour/day)
- Invoice operations (create/update/delete)
- API endpoint usage
- Most accessed pages

---

## Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Layer 1: Network                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  CloudFront + WAF                                             │  │
│  │  - DDoS protection (AWS Shield Standard)                      │  │
│  │  - Rate limiting: 2000 req/5min per IP                        │  │
│  │  - Geo-blocking (optional)                                    │  │
│  │  - SQL injection rules (AWS Managed)                          │  │
│  │  - Known bad inputs (AWS Managed)                             │  │
│  │  - Bot detection                                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Layer 2: Application                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Next.js Security                                             │  │
│  │  - HTTPS only                                                 │  │
│  │  - Security headers (HSTS, CSP, X-Frame-Options)              │  │
│  │  - CSRF protection (NextAuth.js)                              │  │
│  │  - Input validation (Zod schemas)                             │  │
│  │  - SQL injection prevention (parameterized queries)           │  │
│  │  - XSS prevention (React auto-escaping)                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 3: Authentication                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  NextAuth.js v5                                               │  │
│  │  - Bcrypt password hashing (10 rounds)                        │  │
│  │  - HTTP-only session cookies                                  │  │
│  │  - JWT token encryption                                       │  │
│  │  - Session expiration (30 days)                               │  │
│  │  - Protected route middleware                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Layer 4: Infrastructure                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AWS IAM & Secrets                                            │  │
│  │  - Least privilege IAM roles                                  │  │
│  │  - Secrets Manager for credentials                            │  │
│  │  - VPC isolation for database                                 │  │
│  │  - Security groups (Lambda → RDS only)                        │  │
│  │  - Encryption at rest (S3, RDS)                               │  │
│  │  - Encryption in transit (TLS 1.2+)                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Layer 5: Code Security                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Automated Scanning (CI/CD)                                   │  │
│  │  - Trivy: Container & code vulnerabilities                    │  │
│  │  - Snyk: Dependency security                                  │  │
│  │  - npm audit: Known vulnerabilities                           │  │
│  │  - ESLint security rules                                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Security Headers

```typescript
// Configured in next.config.ts
headers: [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]
```

---

## Scalability & Performance

### Auto-Scaling Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Request Load Patterns                             │
│                                                                      │
│  Normal Load (10-100 req/min)                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Lambda: 1-5 concurrent executions                              │ │
│  │ Aurora: 0.5 ACU (staging), 1 ACU (prod)                        │ │
│  │ Cost: ~$5/day                                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Peak Load (500-1000 req/min)                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Lambda: 20-50 concurrent executions                            │ │
│  │ Aurora: Scales to 2-3 ACU                                      │ │
│  │ CloudFront: High cache hit rate (80%+)                         │ │
│  │ Cost: ~$20/day                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Spike Load (2000+ req/min)                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Lambda: Scales to 100+ (limited by reserved concurrency)      │ │
│  │ Aurora: Scales to 4 ACU (max configured)                       │ │
│  │ WAF: Rate limiting kicks in if malicious                       │ │
│  │ Cost: ~$50/day (during spike)                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Performance Optimizations

**Cold Start Mitigation**:
1. **Provisioned Concurrency**: 2 warm instances in production
2. **Lazy Loading**: Heavy dependencies loaded on-demand
3. **Bundle Optimization**: Code splitting with Next.js
4. **Layer Caching**: Node modules in Lambda layer (reused)

**Database Optimization**:
1. **Connection Pooling**: Reuse connections across warm starts
2. **Query Optimization**: Indexes on frequently queried columns
3. **Parallel Queries**: `Promise.all()` for independent queries
4. **Aurora Auto-Scaling**: Automatic ACU scaling based on load

**Caching Strategy**:
1. **CloudFront Edge Cache**:
   - Static assets: 1 year
   - Next.js build files: 1 year (immutable)
   - API routes: No cache
   - Pages: Short TTL with stale-while-revalidate

2. **React Server Components**:
   - Automatic component-level caching
   - Revalidate on demand with `revalidatePath()`

**Performance Metrics**:
- Time to First Byte (TTFB): < 200ms (cached), < 500ms (SSR)
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Total Blocking Time (TBT): < 200ms

---

## Cost Estimation

### Monthly Cost Breakdown (Staging)

```
Service                 | Usage              | Cost
-----------------------|--------------------|---------
Lambda                  | 100K invocations   | $0.20
                       | 50 GB-sec compute  | $1.00
-----------------------|--------------------|---------
Aurora Serverless      | 0.5 ACU × 720h     | $36.00
                       | Storage: 10 GB     | $1.00
                       | I/O: 1M requests   | $0.20
-----------------------|--------------------|---------
CloudFront             | 10 GB transfer     | $0.85
                       | 100K requests      | $0.10
-----------------------|--------------------|---------
S3                     | 5 GB storage       | $0.12
                       | 50K requests       | $0.02
-----------------------|--------------------|---------
CloudWatch             | Logs: 5 GB         | $2.50
                       | Metrics: Custom    | $1.00
-----------------------|--------------------|---------
Total (Staging)                             | ~$43/month
```

### Monthly Cost Breakdown (Production)

```
Service                 | Usage              | Cost
-----------------------|--------------------|---------
Lambda                  | 1M invocations     | $2.00
                       | 500 GB-sec compute | $10.00
                       | Provisioned: 2     | $8.40
-----------------------|--------------------|---------
Aurora Serverless      | 1-4 ACU × 720h     | $72-288
                       | Multi-AZ           | ×2
                       | Storage: 50 GB     | $5.00
                       | I/O: 10M requests  | $2.00
-----------------------|--------------------|---------
CloudFront             | 100 GB transfer    | $8.50
                       | 1M requests        | $1.00
                       | SSL certificate    | $0 (free)
-----------------------|--------------------|---------
S3                     | 20 GB storage      | $0.46
                       | 500K requests      | $0.20
-----------------------|--------------------|---------
WAF                    | Web ACL            | $5.00
                       | Rules: 3           | $3.00
                       | Requests: 1M       | $0.60
-----------------------|--------------------|---------
CloudWatch             | Logs: 20 GB        | $10.00
                       | Metrics: Custom    | $3.00
                       | Alarms: 5          | $0.50
-----------------------|--------------------|---------
Total (Production)                          | ~$180-400/month
                                           (depending on DB load)
```

**Cost Optimization Tips**:
- Use Aurora Auto-Pause in staging (5-minute inactivity)
- Implement CloudFront caching to reduce Lambda invocations
- Archive old CloudWatch logs to S3 Glacier
- Use S3 Intelligent-Tiering for static assets
- Monitor and adjust Aurora min/max ACU based on actual usage

---

## Technology Trade-offs

### SST vs Vercel

| Aspect | SST (Chosen) | Vercel | Decision Rationale |
|--------|-------------|--------|-------------------|
| **Cost** | ~$180/mo (prod) | ~$20/mo (hobby) → $300+/mo (pro) | More control over infrastructure costs |
| **Control** | Full AWS access | Limited configuration | Need custom infrastructure (WAF, monitoring) |
| **Learning** | Learn AWS + IaC | Zero config | Interview showcase - demonstrate AWS knowledge |
| **Scalability** | Unlimited (AWS) | Limited (plan-based) | Can handle enterprise scale |
| **Deployment** | Manual or CI/CD | Git push (automatic) | More control over deployment process |

### Aurora vs Neon

| Aspect | Aurora Serverless v2 | Neon (Current) | Decision |
|--------|---------------------|----------------|----------|
| **Cost** | $72-288/mo | Free → $19/mo | Use Neon for staging, Aurora for production (future) |
| **Performance** | Better for high load | Good for low-moderate load | Start with Neon, migrate if needed |
| **Scalability** | Auto-scales (0.5-128 ACU) | Limited on free tier | Aurora for production growth |
| **Management** | More complex | Fully managed, simpler | Neon for dev speed, Aurora for production |

---

**Last Updated**: October 15, 2025
**Version**: 1.0.0
