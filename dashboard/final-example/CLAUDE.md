# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is the **Next.js Learn Dashboard** final example application, currently being prepared for AWS deployment using SST (Serverless Stack) + OpenNext architecture. The project demonstrates a full-stack Next.js 15 application with App Router, authentication, and PostgreSQL database integration.

**Primary Goal**: Deploy to AWS with production-grade infrastructure, complete DevOps toolchain, and enterprise-level monitoring.

## Development Commands

```bash
# Development server with Turbopack (runs on port 3000, or 3001 if 3000 is occupied)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Database seeding (run development server first)
curl http://localhost:3001/seed
```

## Architecture Overview

### Authentication Flow
The application uses **NextAuth.js v5 (beta.25)** with a custom credential provider:

1. **auth.config.ts**: Edge-compatible configuration defining protected routes
   - All `/dashboard/*` routes require authentication
   - Logged-in users are redirected from root to `/dashboard`
   - Custom sign-in page at `/login`

2. **auth.ts**: Main authentication logic (Node.js only, uses bcrypt)
   - Database user lookup via PostgreSQL
   - Password comparison using bcrypt
   - Returns user object on successful authentication

3. **middleware.ts**: Route protection
   - Runs on all routes except API routes, static files, and images
   - Uses NextAuth's `authorized` callback for access control

### Database Architecture
Uses **PostgreSQL** (currently Neon cloud, will migrate to AWS RDS/Aurora) with direct `postgres` library (not an ORM):

**Schema**:
- `users`: Authentication (id, name, email, password)
- `customers`: Customer records (id, name, email, image_url)
- `invoices`: Invoice management (id, customer_id, amount, status, date)
- `revenue`: Monthly revenue data (month, revenue)

**Database Layer** (`app/lib/data.ts`):
- All queries use the `postgres` SQL template literal syntax
- Connection string from `POSTGRES_URL` environment variable
- SSL required for all connections

**Key Functions**:
- `fetchRevenue()`: Monthly revenue for charts
- `fetchLatestInvoices()`: Last 5 invoices with customer data
- `fetchCardData()`: Dashboard statistics (parallel queries)
- `fetchFilteredInvoices(query, page)`: Paginated invoice search (6 per page)
- `fetchInvoiceById(id)`: Single invoice for edit form

### Server Actions Pattern
Uses Next.js Server Actions (`app/lib/actions.ts`) for all mutations:

- `createInvoice(prevState, formData)`: Create new invoice with validation
- `updateInvoice(id, prevState, formData)`: Update existing invoice
- `deleteInvoice(id)`: Delete invoice
- `authenticate(prevState, formData)`: Handle login

**Validation**: Zod schemas with field-level error messages
**Amounts**: Stored in cents (multiply by 100), displayed as dollars
**Cache**: Uses `revalidatePath()` after mutations to update UI

### Route Structure (App Router)

```
app/
├── page.tsx                    # Public homepage
├── login/                      # Authentication
├── dashboard/
│   ├── layout.tsx             # Dashboard shell with SideNav
│   ├── (overview)/            # Route group - dashboard home
│   │   ├── page.tsx           # Overview with cards & charts
│   │   └── loading.tsx        # Skeleton UI during data fetch
│   ├── invoices/
│   │   ├── page.tsx           # Invoice list with search/pagination
│   │   ├── create/page.tsx    # Create new invoice form
│   │   ├── [id]/edit/page.tsx # Edit invoice form (dynamic route)
│   │   └── error.tsx          # Error boundary for invoices
│   └── customers/
│       └── page.tsx           # Customer list with aggregated data
├── lib/
│   ├── actions.ts             # Server Actions for mutations
│   ├── data.ts                # Database queries
│   ├── definitions.ts         # TypeScript types
│   ├── utils.ts               # Utilities (formatCurrency, etc.)
│   └── placeholder-data.ts    # Seed data
└── seed/
    └── route.ts               # GET /seed endpoint for DB initialization
```

**Route Group `(overview)`**: Organizes files without affecting URL structure

### Type System
All types manually defined in `app/lib/definitions.ts`:
- **Raw types**: Database shape (amounts as numbers)
- **Formatted types**: Display shape (amounts as currency strings)
- **Form types**: Input validation shape

## Environment Variables

**Required** (stored in `.env.local`, never commit):

```bash
# PostgreSQL connection (currently Neon, will be RDS in production)
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
POSTGRES_PRISMA_URL=<same as above>
POSTGRES_URL_NON_POOLING=<direct connection, no pooler>
POSTGRES_USER=<username>
POSTGRES_HOST=<hostname>
POSTGRES_PASSWORD=<password>
POSTGRES_DATABASE=<database name>

# NextAuth (generate with: openssl rand -base64 32)
AUTH_SECRET=<secret>
AUTH_URL=http://localhost:3001/api/auth  # Update for production
```

**Test Credentials**:
- Email: `user@nextmail.com`
- Password: `123456`

## Database Operations

### Seeding
The seed endpoint (`/seed`) creates tables and inserts sample data:
1. Creates UUID extension
2. Creates all tables (users, customers, invoices, revenue)
3. Inserts data with `ON CONFLICT DO NOTHING` for idempotency
4. Hashes user password with bcrypt (10 rounds)

**Important**: Amounts in seed data are already in cents

### Queries
- Use SQL template literals with the `postgres` library
- All queries return promises
- Type assertions: `await sql<Type[]>\`...\``
- SSL is required (`{ ssl: 'require' }`)

## Styling & UI

- **Tailwind CSS**: Utility-first styling
- **@tailwindcss/forms**: Form element styling
- **@heroicons/react**: Icon library
- **Fonts**: Lusitana (headings), Inter (body) via `next/font/google`
- **clsx**: Conditional class name composition

## Upcoming Infrastructure (Phase 2+)

When implementing SST + OpenNext deployment, be aware:

1. **Environment Variables**: Move to AWS Secrets Manager for production
2. **Database Migration**: Export Neon schema → Import to RDS Aurora Serverless
3. **Authentication**: Update `AUTH_URL` to CloudFront domain
4. **Static Assets**: Will be served from S3 + CloudFront
5. **Server Functions**: Lambda functions for SSR pages and API routes

### Files to Create (SST)
- `sst.config.ts`: Main SST configuration with NextjsSite construct
- `stacks/Database.ts`: RDS Aurora Serverless v2 (0.5-4 ACU)
- `stacks/Security.ts`: WAF rules, rate limiting, SQL injection protection
- `stacks/Monitoring.ts`: CloudWatch dashboards, alarms, SNS topics

## Known Configuration

- **Package Manager**: Uses npm (pnpm-lock.yaml exists but npm is primary)
- **Node Version**: 18.20.5 (compatible with Lambda Node.js 18.x runtime)
- **Next.js Version**: 15.5.5 with Turbopack
- **TypeScript**: Strict mode enabled
- **Development Port**: 3001 (3000 was already in use)

## Important Implementation Details

### Amount Handling
- **Database**: Stores amounts in cents (integer)
- **Forms**: Users enter dollars (converted to cents × 100)
- **Display**: Formatted as currency using `formatCurrency(amount / 100)`

### Search & Pagination
- **Search**: Case-insensitive ILIKE across name, email, amount, date, status
- **Pagination**: 6 items per page (`ITEMS_PER_PAGE = 6`)
- **Offset**: `(currentPage - 1) * ITEMS_PER_PAGE`

### Form Validation
- Uses Zod schemas with `safeParse()` for type-safe validation
- Returns field-level errors: `{ errors: { field: ['message'] }, message: string }`
- Server Actions return `State` type with errors and message
- Forms use `useFormState` hook for progressive enhancement

### Error Handling
- **Error Boundaries**: `error.tsx` files catch runtime errors in routes
- **Not Found**: `not-found.tsx` for 404 pages
- **Database Errors**: Wrapped in try-catch with user-friendly messages

## Project Status

**Phase 1 Complete** ✅: Local development environment fully functional

**Next Phases** (see PROJECT_PROGRESS.md for details):
- Phase 2: SST Infrastructure Setup
- Phase 3: Complete DevOps Toolchain (GitHub Actions CI/CD)
- Phase 4: Testing Strategy (E2E with Playwright, load tests with k6)
- Phase 5: AWS Deployment
- Phase 6: Documentation & README

## Reference Files

- `PROJECT_PROGRESS.md`: Detailed deployment plan and progress tracker
- `RESUME_TOMORROW.md`: Quick start guide for resuming work
- `.env.example`: Environment variable template
