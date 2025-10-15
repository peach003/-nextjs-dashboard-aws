# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 15 Dashboard** application deployed to AWS using **SST v3 + OpenNext** serverless architecture. The project demonstrates production-grade infrastructure, complete CI/CD with GitHub Actions, and enterprise DevOps practices.

**Current Status**: Fully deployed to AWS staging environment
- **Live URL**: https://d3pq0ftcbhgpo5.cloudfront.net
- **Repository**: https://github.com/peach003/-nextjs-dashboard-aws
- **Test Login**: user@nextmail.com / 123456

## Repository Structure

This is a **monorepo** with the main application in a subdirectory:

```
/home/zhanglin/devops/next-learn/
├── .github/workflows/          # GitHub Actions CI/CD (repository root)
│   └── deploy-dashboard.yml    # 5-stage deployment pipeline
├── dashboard/final-example/    # Main Next.js application
│   ├── app/                    # Next.js App Router
│   ├── sst.config.ts          # SST infrastructure configuration
│   ├── auth.ts, middleware.ts # NextAuth.js setup
│   └── package.json           # Application dependencies
├── DEPLOYMENT_GUIDE.md         # Comprehensive deployment guide (2,600+ lines)
└── CLAUDE.md                   # This file
```

**CRITICAL**: The application code is in `dashboard/final-example/`, NOT the repository root. Always use `cd dashboard/final-example` before running npm commands.

## Development Commands

All commands must be run from `dashboard/final-example/` directory:

```bash
# Navigate to application directory
cd dashboard/final-example

# Development server (Turbopack, port 3001)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Quality checks
npm run lint              # ESLint
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format with Prettier
npm run format:check      # Check formatting
npm run type-check        # TypeScript checking
npm test                  # Run all quality checks

# Database operations
curl http://localhost:3001/seed  # Seed database (dev server must be running)

# SST deployment commands
npm run sst:deploy:staging   # Deploy to staging
npm run sst:deploy:prod      # Deploy to production
npm run sst:console          # Open SST web console
npm run sst:logs             # View Lambda logs

# Testing commands
npm run test:e2e             # Run Playwright E2E tests
npm run test:e2e:ui          # Run E2E with UI mode
npm run test:integration     # Run integration tests
npm run test:all             # Run all tests
```

## Critical Configuration Notes

### 1. Monorepo GitHub Actions Setup

GitHub Actions workflows are at repository root (`.github/workflows/`), but the application is in a subdirectory. All jobs must specify:

```yaml
defaults:
  run:
    working-directory: dashboard/final-example
```

This applies to ALL jobs: quality, security, build, deploy-staging, deploy-production.

### 2. Dynamic Rendering Required

**CRITICAL**: All dashboard pages must use `export const dynamic = 'force-dynamic'` to prevent build-time database connection errors:

```typescript
// Add to top of these files:
export const dynamic = 'force-dynamic';

// Files requiring this:
// - app/dashboard/(overview)/page.tsx
// - app/dashboard/customers/page.tsx
// - app/dashboard/invoices/page.tsx
// - app/dashboard/invoices/create/page.tsx
// - app/dashboard/invoices/[id]/edit/page.tsx
```

**Why**: Next.js App Router tries to pre-render pages at build time. Pages that fetch from database will fail during build if database is unavailable or if you want runtime data fetching.

### 3. ESLint Triple-Slash Reference

SST requires a triple-slash reference in `sst.config.ts` which conflicts with ESLint rules. It's already configured with disable/enable comments - do not remove them:

```typescript
/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
```

## Architecture

### Authentication Flow (NextAuth.js v5)

Three-file authentication system:

1. **auth.config.ts** (Edge-compatible):
   - Defines protected routes (`/dashboard/*`)
   - Configures redirect behavior
   - Used by middleware

2. **auth.ts** (Node.js only):
   - Credential provider with bcrypt password hashing
   - Database user lookup
   - Cannot run on Edge runtime (uses bcrypt)

3. **middleware.ts**:
   - Runs on all routes except API routes, static files, images
   - Enforces authentication using `auth.config.ts`
   - Redirects unauthorized users to `/login`

### Database Architecture

**Database**: PostgreSQL via Neon (serverless, cloud-hosted)
**Client**: `postgres` library (NOT Prisma or other ORM)

**Schema**:
- `users`: id, name, email, password (bcrypt hashed)
- `customers`: id, name, email, image_url
- `invoices`: id, customer_id, amount (in cents!), status, date
- `revenue`: month, revenue

**Data Layer** (`app/lib/data.ts`):
- All queries use SQL template literals: `sql<Type[]>\`SELECT ...\``
- Connection pooling via Neon's connection string
- SSL required: `?sslmode=require`

**Key Functions**:
- `fetchRevenue()`: Monthly revenue for charts
- `fetchLatestInvoices()`: Last 5 invoices with JOIN to customers
- `fetchCardData()`: Dashboard stats (parallel Promise.all queries)
- `fetchFilteredInvoices(query, page)`: Search + pagination (6/page)
- `fetchInvoiceById(id)`: Single invoice for edit form

### Server Actions Pattern

**Location**: `app/lib/actions.ts`

All mutations use Next.js Server Actions (not API routes):
- `createInvoice(prevState, formData)`: Create with Zod validation
- `updateInvoice(id, prevState, formData)`: Update existing
- `deleteInvoice(id)`: Delete with revalidation
- `authenticate(prevState, formData)`: Handle login

**Validation**: Zod schemas with field-level errors
**Amounts**: User inputs dollars, stored as cents (multiply by 100)
**Cache**: `revalidatePath()` after mutations

### Route Structure (App Router)

```
app/
├── page.tsx                      # Public homepage
├── login/page.tsx                # Login form
├── dashboard/
│   ├── layout.tsx               # Shared dashboard shell with SideNav
│   ├── (overview)/              # Route group (doesn't affect URL)
│   │   ├── page.tsx             # /dashboard - overview page
│   │   └── loading.tsx          # Skeleton UI during fetch
│   ├── invoices/
│   │   ├── page.tsx             # /dashboard/invoices - list with search
│   │   ├── create/page.tsx      # /dashboard/invoices/create
│   │   ├── [id]/edit/page.tsx   # /dashboard/invoices/123/edit (dynamic)
│   │   └── error.tsx            # Error boundary
│   └── customers/page.tsx       # /dashboard/customers
├── lib/
│   ├── actions.ts               # Server Actions (mutations)
│   ├── data.ts                  # Database queries
│   ├── definitions.ts           # TypeScript types
│   ├── utils.ts                 # formatCurrency, formatDateToLocal
│   └── placeholder-data.ts      # Seed data
├── ui/                          # Reusable components
└── seed/route.ts                # GET /seed endpoint
```

**Route Group `(overview)`**: Organizes files without affecting URL paths. `/dashboard/(overview)/page.tsx` → `/dashboard`

## Environment Variables

**Required Secrets** (never commit):

```bash
# PostgreSQL (Neon cloud database)
POSTGRES_URL="postgresql://user:pass@host/db?sslmode=require"
POSTGRES_PRISMA_URL="<same as above>"
POSTGRES_URL_NON_POOLING="<direct connection, no pooler>"
POSTGRES_USER="username"
POSTGRES_HOST="ep-xxx.region.aws.neon.tech"
POSTGRES_PASSWORD="password"
POSTGRES_DATABASE="database_name"

# NextAuth.js
AUTH_SECRET="<generate with: openssl rand -base64 32>"
AUTH_URL="https://d3pq0ftcbhgpo5.cloudfront.net/api/auth"  # CloudFront URL in production
```

**Local Development**: `.env.local` (gitignored)
**Deployment**: GitHub Secrets (12 secrets for staging, 20+ for production)

### AUTH_URL Configuration

**CRITICAL**: AUTH_URL must match deployment environment:
- Local: `http://localhost:3001/api/auth`
- Staging: `https://<cloudfront-url>/api/auth`
- Production: `https://<custom-domain>/api/auth`

**Common Error**: If AUTH_URL is wrong, login will redirect back to login page with no error message.

## Deployment Architecture

### Infrastructure Components

```
GitHub Actions → AWS Cloud
                 ├─ CloudFront CDN (d3pq0ftcbhgpo5.cloudfront.net)
                 ├─ S3 Bucket (static assets: /_next/*, /images/*)
                 ├─ Lambda Functions (SSR pages, API routes)
                 └─ Neon PostgreSQL (external, cloud database)
```

**SST Configuration** (`sst.config.ts`):
- App name: `nextjs-dashboard`
- Region: `ap-southeast-2` (Sydney)
- Staging: 1GB RAM Lambda, "remove" on `sst remove`
- Production: 2GB RAM Lambda, "retain" on `sst remove`
- Environment variables passed to Lambda automatically

### CI/CD Pipeline (GitHub Actions)

**Workflow Location**: `.github/workflows/deploy-dashboard.yml` (repository root)

**5-Stage Pipeline**:

1. **Code Quality** (~2 min):
   - ESLint (non-blocking with `continue-on-error: true`)
   - TypeScript type checking (non-blocking)
   - Prettier formatting (non-blocking)

2. **Security Scan** (~3 min):
   - Trivy vulnerability scanner
   - Snyk dependency security
   - npm audit (high severity only)

3. **Build** (~3-5 min):
   - `npm ci`
   - `npm run build`
   - Uses real database credentials (Neon is cloud-accessible)

4. **Deploy to Staging** (~5-8 min):
   - Automatic on push to main
   - AWS credential configuration
   - `npm run sst:deploy:staging`
   - Environment variables from GitHub Secrets

5. **Deploy to Production** (disabled):
   - Currently commented out (no PROD_* secrets configured)
   - Requires manual approval when enabled
   - To enable: uncomment in workflow + add PROD_* secrets

### Deployment Trigger

Automatic deployment on:
- Push to `main` branch
- Manual workflow dispatch

**Note**: Pull requests only run quality checks + security scan + build (no deployment).

## Critical Implementation Details

### 1. Amount Handling (Money)

**Database**: Amounts stored as INTEGER in cents
**Forms**: User enters dollars (e.g., `123.45`)
**Conversion**: Multiply by 100 before saving (`12345` cents)
**Display**: Divide by 100 and format (`$123.45`)

```typescript
// Display
formatCurrency(amount / 100)  // 12345 → "$123.45"

// Save
const amountInCents = amount * 100  // 123.45 → 12345
```

**IMPORTANT**: Seed data amounts are ALREADY in cents.

### 2. Search & Pagination

**Search**: Case-insensitive ILIKE across:
- Customer name
- Customer email
- Invoice amount (as text)
- Invoice date (formatted)
- Invoice status

**Pagination**:
- Items per page: 6 (`ITEMS_PER_PAGE = 6`)
- Offset calculation: `(currentPage - 1) * 6`
- URL state: `?query=search&page=2`

### 3. Form Validation (Zod)

All forms use Zod schemas with `safeParse()`:

```typescript
const FormSchema = z.object({
  customerId: z.string(),
  amount: z.coerce.number().positive(),
  status: z.enum(['pending', 'paid']),
});

const validatedFields = FormSchema.safeParse({
  customerId: formData.get('customerId'),
  amount: formData.get('amount'),
  status: formData.get('status'),
});

if (!validatedFields.success) {
  return {
    errors: validatedFields.error.flatten().fieldErrors,
    message: 'Missing Fields. Failed to Create Invoice.',
  };
}
```

Returns field-level errors: `{ errors: { amount: ['Amount must be positive'] } }`

### 4. Error Handling

**Error Boundaries**: `error.tsx` files catch runtime errors in route segments
**Not Found**: `not-found.tsx` for 404 pages (call `notFound()` function)
**Database Errors**: Wrapped in try-catch with user-friendly messages

### 5. Type System

All types in `app/lib/definitions.ts`:
- **Raw types**: Database shape (amounts as numbers)
- **Formatted types**: Display shape (amounts as formatted currency strings)
- **Form types**: Zod validation shape

No TypeScript in SQL queries - using type assertions:
```typescript
const data = await sql<InvoiceTable[]>`SELECT ...`;
```

## Common Issues & Solutions

### Issue: "Database connection refused" during build

**Cause**: Next.js tries to pre-render pages at build time, but database not accessible.

**Solution**: Add `export const dynamic = 'force-dynamic'` to force runtime rendering.

### Issue: Login redirects back to login page

**Cause**: AUTH_URL environment variable incorrect or missing.

**Solution**:
1. Verify AUTH_URL in `.env.local` or GitHub Secrets
2. Must match deployed domain: `https://<cloudfront-url>/api/auth`
3. Redeploy after updating

### Issue: GitHub Actions workflow not triggering

**Cause**: Workflow file must be at repository root, not in subdirectory.

**Solution**:
- Workflow location: `.github/workflows/deploy-dashboard.yml` (root)
- Use `working-directory: dashboard/final-example` in job defaults

### Issue: ESLint error on sst.config.ts triple-slash reference

**Cause**: ESLint rule prohibits triple-slash references, but SST requires it.

**Solution**: Already configured with eslint-disable comments - do not remove them.

### Issue: Production deployment failing

**Cause**: Production deployment job runs automatically but lacks PROD_* secrets.

**Solution**: Production deployment is disabled (commented out in workflow). Enable only when ready with proper secrets.

## Testing Strategy

### E2E Tests (Playwright)

**Location**: `tests/e2e/`

Run tests:
```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # UI mode
npm run test:e2e:headed   # Headed browser
npm run test:e2e:debug    # Debug mode
```

**Test files**:
- `auth.spec.ts`: Login/logout flows
- `invoices.spec.ts`: CRUD operations
- `search-pagination.spec.ts`: Search and pagination

### Integration Tests

**Location**: `tests/integration/`

Run tests:
```bash
npm run test:integration
```

Tests API routes and database connections.

### Load Testing (k6)

**Location**: `tests/load/`

Run tests:
```bash
k6 run tests/load/smoke-test.js    # 1 user, 1 min
k6 run tests/load/load-test.js     # up to 100 users
k6 run tests/load/stress-test.js   # up to 200 users
```

## Styling & UI

- **Framework**: Tailwind CSS 3.4.17
- **Forms**: @tailwindcss/forms plugin
- **Icons**: @heroicons/react (outline and solid)
- **Fonts**: Lusitana (headings), Inter (body) via `next/font/google`
- **Utilities**: `clsx` for conditional classes

## Key Technologies

- **Next.js**: 15.5.5 (App Router, Server Actions, Turbopack)
- **React**: latest (19.x)
- **TypeScript**: 5.7.3 (strict mode)
- **Node.js**: 18.20.5 (Lambda-compatible)
- **Database**: PostgreSQL 15+ via Neon
- **Database Client**: postgres.js 3.4.6 (NOT Prisma)
- **Auth**: NextAuth.js 5.0.0-beta.25
- **IaC**: SST v3.17.19 (Ion)
- **Testing**: Playwright 1.56.0, k6
- **CI/CD**: GitHub Actions
- **Deployment**: AWS Lambda + S3 + CloudFront

## Project Status

**Deployment Status**: ✅ Fully deployed to AWS staging
- All 18 phases completed
- CI/CD pipeline working (all green ✅)
- Comprehensive documentation created

**Current Environment**:
- Staging: https://d3pq0ftcbhgpo5.cloudfront.net
- Production: Not yet configured (disabled in workflow)

## Reference Documentation

**Essential Guides** (all in repository root):
- `DEPLOYMENT_GUIDE.md`: Complete deployment walkthrough with 2,600+ lines covering:
  - All 9 errors encountered and solutions
  - Step-by-step deployment process
  - Architecture diagrams
  - Security considerations
  - Cost optimization
  - Troubleshooting guide

**Application-Specific** (in `dashboard/final-example/`):
- `README.md`: Project overview and features
- `sst.config.ts`: Infrastructure configuration
- `package.json`: All available npm scripts

## Important Reminders

1. **Always work in `dashboard/final-example/`**: The application is NOT at repository root
2. **Dynamic rendering required**: Add `export const dynamic = 'force-dynamic'` to database-fetching pages
3. **Amounts in cents**: Database stores cents, display as dollars
4. **AUTH_URL must match environment**: Update after deployment
5. **GitHub Actions uses working-directory**: All jobs specify subdirectory path
6. **Quality checks are non-blocking**: They run but don't fail the build
7. **Production is disabled**: Enable only when ready with PROD_* secrets
8. **Neon database is cloud-accessible**: Can be used during GitHub Actions build
9. **Test credentials**: user@nextmail.com / 123456
10. **CloudFront URL**: https://d3pq0ftcbhgpo5.cloudfront.net

## When Making Changes

### Adding New Database-Fetching Pages

```typescript
// ALWAYS add this at the top:
export const dynamic = 'force-dynamic';

// Then your page component:
export default async function Page() {
  const data = await fetchFromDatabase();
  return <div>{/* ... */}</div>;
}
```

### Adding New Environment Variables

1. Add to `sst.config.ts` environment object
2. Add to GitHub Secrets (staging and/or production)
3. Update `.env.example` for documentation
4. Redeploy

### Modifying GitHub Actions Workflow

1. Edit `.github/workflows/deploy-dashboard.yml`
2. Ensure `working-directory: dashboard/final-example` in all jobs
3. Test with workflow_dispatch (manual trigger) before pushing to main

### Database Schema Changes

1. Connect to Neon database
2. Run SQL migrations manually (no Prisma migrations)
3. Update `app/lib/definitions.ts` with new types
4. Update queries in `app/lib/data.ts`
5. Test locally before deploying

## Working with SST

### Common SST Commands

```bash
cd dashboard/final-example

# Deploy to staging
npm run sst:deploy:staging

# Deploy to production
npm run sst:deploy:prod

# Open SST console (web UI)
npm run sst:console

# View logs (tail)
npx sst logs --tail

# View logs for specific function
npx sst logs FunctionName

# Get deployment URL
npx sst url --stage staging

# Remove deployment
npx sst remove --stage staging
```

### SST Project Structure

```
dashboard/final-example/
├── sst.config.ts           # Main configuration
├── .sst/                   # SST metadata (gitignored)
│   ├── platform/           # SST platform files
│   └── stage/              # Stage-specific state
└── .open-next/             # OpenNext build output (gitignored)
```

**Note**: SST state is stored in AWS (S3 + DynamoDB), not locally.

## Security Notes

1. **Never commit secrets**: All `.env*` files are gitignored except `.env.example`
2. **GitHub Secrets**: 12 required for staging deployment
3. **HTTPS only**: Enforced by CloudFront
4. **Password hashing**: bcrypt with 10 rounds
5. **CSRF protection**: Built into NextAuth.js
6. **SQL injection**: Protected by parameterized queries (postgres.js)
7. **Input validation**: Zod schemas on all forms
8. **Authentication**: Middleware protects all `/dashboard/*` routes

## Cost Information

**Current Staging Costs**: $0-5/month (mostly within AWS free tier)
- Lambda: 1M requests/month free
- CloudFront: 1TB data transfer/month free
- S3: 5GB storage free
- Neon: Free tier (500MB, shared compute)

**Production Estimates** (moderate traffic): $10-50/month
- Depends on traffic, database usage, Lambda invocations

See `DEPLOYMENT_GUIDE.md` for detailed cost breakdown and optimization strategies.
