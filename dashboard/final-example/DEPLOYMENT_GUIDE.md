# AWS Deployment Guide

Complete guide for deploying the Next.js Dashboard to AWS using SST (Serverless Stack).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Setup](#aws-setup)
3. [Environment Variables](#environment-variables)
4. [Local Deployment Test](#local-deployment-test)
5. [Deploy to Staging](#deploy-to-staging)
6. [Deploy to Production](#deploy-to-production)
7. [Post-Deployment](#post-deployment)
8. [Monitoring](#monitoring)
9. [Rollback](#rollback)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

✅ **Node.js 18+**
```bash
node --version  # Should be v18.x or higher
```

✅ **npm**
```bash
npm --version  # Should be 10.x or higher
```

✅ **AWS CLI** (Install if not present)
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download from: https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify installation
aws --version
```

✅ **Git**
```bash
git --version
```

### AWS Account Requirements

- Active AWS account
- IAM user with appropriate permissions
- Access key and secret key
- Billing alerts configured (recommended)

---

## AWS Setup

### Step 1: Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Enter your credentials:
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json
```

**Verify configuration:**
```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### Step 2: Required IAM Permissions

Your AWS user needs these permissions:
- CloudFormation (full)
- S3 (full)
- Lambda (full)
- CloudFront (full)
- IAM (pass role, create role)
- CloudWatch (logs, metrics)
- SSM Parameter Store (read/write)

**Recommended**: Use `AdministratorAccess` policy for initial deployment, then restrict later.

---

## Environment Variables

### Step 1: Create Environment Files

**For Staging:**
```bash
cp .env.local .env.staging
```

**For Production:**
```bash
cp .env.local .env.production
```

### Step 2: Update Environment Variables

**`.env.staging`** (or use existing Neon DB):
```bash
# Database (Neon PostgreSQL - existing)
POSTGRES_URL="postgresql://neondb_owner:your-password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
POSTGRES_PRISMA_URL="postgresql://neondb_owner:your-password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
POSTGRES_URL_NON_POOLING="postgresql://neondb_owner:your-password@ep-xxx.aws.neon.tech/neondb?sslmode=require&connection_limit=1"
POSTGRES_USER="neondb_owner"
POSTGRES_HOST="ep-xxx.aws.neon.tech"
POSTGRES_PASSWORD="your-password"
POSTGRES_DATABASE="neondb"

# NextAuth
AUTH_SECRET="uf1AnXA4lVm2hJmbwwtyV4nVHBAfz/NQQF23cwBj1W8="  # Keep same as local
AUTH_URL="https://your-staging-url.cloudfront.net/api/auth"  # Update after first deploy
```

**`.env.production`**:
```bash
# Same as staging, but use production database
# Update AUTH_URL to production CloudFront URL
```

### Step 3: Export Variables for Deployment

**For Staging:**
```bash
export $(cat .env.staging | xargs)
```

**For Production:**
```bash
export $(cat .env.production | xargs)
```

---

## Local Deployment Test

Before deploying to AWS, test the build locally:

### Step 1: Build the Application

```bash
npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                   ...
└ ○ /login                              ...
```

### Step 2: Test Production Build

```bash
npm start
```

Visit: http://localhost:3000

✅ **Verify**:
- Login works
- Dashboard loads
- Invoices CRUD operations work
- Search and pagination work

---

## Deploy to Staging

### Pre-Deployment Checklist

- [ ] AWS credentials configured
- [ ] Environment variables exported
- [ ] Local build successful
- [ ] Database accessible (Neon or RDS)
- [ ] All tests passing (`npm test`)

### Step 1: Initial Deployment

```bash
# Make sure environment variables are exported
export $(cat .env.staging | xargs)

# Deploy to staging
npm run sst:deploy:staging
```

**What happens:**
1. SST builds your Next.js app
2. Converts to Lambda functions (OpenNext)
3. Creates S3 bucket for static assets
4. Creates CloudFront distribution
5. Deploys Lambda functions
6. Outputs deployment URL

**Expected duration**: 5-10 minutes for first deployment

### Step 2: Get Deployment URL

After deployment completes:

```bash
# Get the staging URL
npx sst url --stage staging
```

Example output:
```
https://d1234567890abc.cloudfront.net
```

### Step 3: Update AUTH_URL

Update `.env.staging` with the actual URL:
```bash
AUTH_URL="https://d1234567890abc.cloudfront.net/api/auth"
```

### Step 4: Redeploy with Updated AUTH_URL

```bash
export $(cat .env.staging | xargs)
npm run sst:deploy:staging
```

---

## Deploy to Production

### Pre-Deployment Checklist

- [ ] Staging deployment successful
- [ ] Staging tests passing
- [ ] Production database ready
- [ ] Production environment variables configured
- [ ] Team approval obtained

### Step 1: Deploy to Production

```bash
# Export production environment variables
export $(cat .env.production | xargs)

# Deploy to production
npm run sst:deploy:prod
```

### Step 2: Get Production URL

```bash
npx sst url --stage prod
```

### Step 3: Update Production AUTH_URL

Update `.env.production`:
```bash
AUTH_URL="https://your-prod-url.cloudfront.net/api/auth"
```

Redeploy:
```bash
export $(cat .env.production | xargs)
npm run sst:deploy:prod
```

### Step 4: Custom Domain (Optional)

If you have a custom domain:

1. Update `sst.config.ts`:
```typescript
domain: $app.stage === "production"
  ? "dashboard.yourdomain.com"
  : undefined,
```

2. Redeploy:
```bash
npm run sst:deploy:prod
```

SST will:
- Create SSL certificate
- Configure CloudFront
- Set up DNS (if using Route53)

---

## Post-Deployment

### Verify Deployment

Run the post-deployment verification script:

```bash
./scripts/verify-deployment.sh https://your-staging-url.cloudfront.net
```

**Manual Verification Checklist:**

- [ ] Homepage loads successfully
- [ ] Login page accessible
- [ ] Can log in with test credentials
- [ ] Dashboard displays
- [ ] Can create invoice
- [ ] Can edit invoice
- [ ] Can delete invoice
- [ ] Search works
- [ ] Pagination works
- [ ] No console errors

### Run Smoke Tests

```bash
# Update BASE_URL in load test
k6 run tests/load/smoke-test.js -e BASE_URL=https://your-url.cloudfront.net
```

### Check CloudWatch Logs

```bash
# View Lambda logs
npx sst logs --stage staging

# Or via AWS Console
# CloudWatch → Log Groups → /aws/lambda/...
```

---

## Monitoring

### CloudWatch Dashboard

1. Go to AWS Console → CloudWatch → Dashboards
2. Find `nextjs-dashboard-staging` or `nextjs-dashboard-prod`
3. Monitor:
   - Lambda invocations
   - Error rates
   - Response times
   - Database connections

### CloudWatch Alarms

Check alarms:
```bash
aws cloudwatch describe-alarms --alarm-names dashboard-lambda-errors-staging
```

### Custom Metrics

Your app sends custom metrics:
- User logins
- Invoice operations
- API latency
- Database query times

View in CloudWatch → Metrics → Custom Namespaces → `NextjsDashboard`

### Cost Monitoring

Check estimated costs:
```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

**Expected Monthly Costs**:
- **Staging**: $7-15 (with Neon free tier)
- **Production**: $30-60

---

## Rollback

### Automatic Rollback (if health check fails)

SST doesn't have built-in automatic rollback. If deployment fails:

```bash
# Deploy previous version from git
git checkout <previous-commit>
npm run sst:deploy:staging
```

### Manual Rollback

#### Option 1: Redeploy Previous Version

```bash
# Find previous working commit
git log --oneline

# Checkout that commit
git checkout abc1234

# Redeploy
npm run sst:deploy:prod

# Return to main
git checkout main
```

#### Option 2: Remove and Redeploy

```bash
# Remove broken deployment
npm run sst:remove -- --stage staging

# Checkout previous version
git checkout <previous-commit>

# Deploy previous version
npm run sst:deploy:staging
```

### Rollback Checklist

- [ ] Identify the issue
- [ ] Find last working version (git commit)
- [ ] Notify team
- [ ] Checkout previous version
- [ ] Redeploy
- [ ] Verify rollback successful
- [ ] Post-mortem analysis

---

## Troubleshooting

### Deployment Fails

**Error: "AWS credentials not configured"**
```bash
# Solution: Configure AWS CLI
aws configure
aws sts get-caller-identity
```

**Error: "Insufficient permissions"**
```bash
# Solution: Check IAM permissions
aws iam get-user
# Contact AWS administrator to grant required permissions
```

**Error: "Build failed"**
```bash
# Solution: Test build locally first
npm run build

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint
```

### Application Errors After Deployment

**500 Internal Server Error**

1. Check Lambda logs:
```bash
npx sst logs --stage staging --tail
```

2. Check environment variables:
```bash
npx sst console --stage staging
# View environment variables in console
```

**Database Connection Errors**

1. Verify database is accessible from internet
2. Check connection string in environment variables
3. Test database connection locally:
```bash
psql $POSTGRES_URL
```

4. Check Neon dashboard for connection limits

**Authentication Not Working**

1. Verify AUTH_URL matches deployed URL
2. Check AUTH_SECRET is set
3. Clear browser cookies
4. Check NextAuth logs in CloudWatch

### Performance Issues

**Slow Response Times**

1. Check Lambda memory allocation (increase if needed)
2. Check database query performance
3. Enable CloudFront caching
4. Check cold start times

**High Error Rates**

1. Check CloudWatch logs for error patterns
2. Verify database connection pool settings
3. Check Lambda timeout settings
4. Review recent deployments

---

## Quick Reference

### Common Commands

```bash
# Deploy
npm run sst:deploy:staging
npm run sst:deploy:prod

# View logs
npx sst logs --stage staging --tail

# Get deployment URL
npx sst url --stage staging

# Open SST console
npx sst console --stage staging

# Remove deployment
npm run sst:remove -- --stage staging

# Build locally
npm run build

# Run tests
npm run test:all
```

### Environment Variables Checklist

- [ ] POSTGRES_URL
- [ ] POSTGRES_PRISMA_URL
- [ ] POSTGRES_URL_NON_POOLING
- [ ] POSTGRES_USER
- [ ] POSTGRES_HOST
- [ ] POSTGRES_PASSWORD
- [ ] POSTGRES_DATABASE
- [ ] AUTH_SECRET
- [ ] AUTH_URL (update after first deploy)

### Deployment Workflow

```
1. Test locally → npm run build && npm start
2. Run tests → npm run test:all
3. Export env vars → export $(cat .env.staging | xargs)
4. Deploy to staging → npm run sst:deploy:staging
5. Get URL → npx sst url --stage staging
6. Update AUTH_URL → Edit .env.staging
7. Redeploy → npm run sst:deploy:staging
8. Verify → Visit URL and test
9. Run smoke test → k6 run tests/load/smoke-test.js
10. Deploy to prod → npm run sst:deploy:prod
```

---

## Support & Resources

### Documentation
- **SST**: https://docs.sst.dev
- **OpenNext**: https://open-next.js.org
- **AWS Lambda**: https://docs.aws.amazon.com/lambda
- **CloudFront**: https://docs.aws.amazon.com/cloudfront

### Getting Help
- SST Discord: https://discord.gg/sst
- AWS Support: https://console.aws.amazon.com/support
- GitHub Issues: Create issue in your repository

### Cost Optimization
- Use staging for testing only
- Remove unused deployments: `npm run sst:remove`
- Set up billing alerts
- Monitor CloudWatch costs
- Use reserved concurrency carefully

---

**Last Updated**: October 15, 2025
**Version**: 1.0.0
**Status**: Ready for deployment
