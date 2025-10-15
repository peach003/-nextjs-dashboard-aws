# GitHub Actions & Environments Setup

Complete guide for setting up GitHub Actions CI/CD with AWS deployment.

---

## Table of Contents

1. [Create GitHub Repository](#create-github-repository)
2. [Configure GitHub Secrets](#configure-github-secrets)
3. [Set Up Environments](#set-up-environments)
4. [Test the Pipeline](#test-the-pipeline)
5. [Troubleshooting](#troubleshooting)

---

## Create GitHub Repository

### Option 1: Create New Repository

```bash
# Initialize git (if not already done)
cd /home/zhanglin/devops/next-learn/dashboard/final-example
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Next.js Dashboard with SST"

# Create repository on GitHub
# Go to: https://github.com/new

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/nextjs-dashboard.git
git branch -M main
git push -u origin main
```

### Option 2: Fork Existing Repository

```bash
# Fork on GitHub: https://github.com/vercel/next-learn
# Then clone your fork and copy final-example files
```

---

## Configure GitHub Secrets

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings**
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Step 2: Add AWS Credentials

Create these repository secrets:

#### `AWS_ACCESS_KEY_ID`
```
Your AWS access key ID
Example: AKIAIOSFODNN7EXAMPLE
```

#### `AWS_SECRET_ACCESS_KEY`
```
Your AWS secret access key
Example: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**How to get AWS credentials:**
1. Go to AWS IAM Console
2. Create new user: `github-actions-deploy`
3. Attach policies: `AdministratorAccess` (or custom policy)
4. Create access key
5. Save Access Key ID and Secret Access Key

### Step 3: Add Shared Secrets

#### `AUTH_SECRET`
```bash
# Generate with:
openssl rand -base64 32

# Use the SAME secret for all environments
```

Example:
```
uf1AnXA4lVm2hJmbwwtyV4nVHBAfz/NQQF23cwBj1W8=
```

#### `SNYK_TOKEN` (Optional - for security scanning)
```
Get from: https://app.snyk.io/account
```

---

## Set Up Environments

GitHub Environments allow environment-specific secrets and protection rules.

### Step 1: Create Staging Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `staging`
4. Click **Configure environment**

#### Staging Environment Secrets

Add these environment secrets:

**`STAGING_POSTGRES_URL`**
```
postgresql://neondb_owner:password@ep-xxx-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
```

**`STAGING_POSTGRES_PRISMA_URL`**
```
Same as STAGING_POSTGRES_URL
```

**`STAGING_POSTGRES_URL_NON_POOLING`**
```
postgresql://neondb_owner:password@ep-xxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&connection_limit=1
```

**`STAGING_POSTGRES_USER`**
```
neondb_owner
```

**`STAGING_POSTGRES_HOST`**
```
ep-xxx-pooler.ap-southeast-2.aws.neon.tech
```

**`STAGING_POSTGRES_PASSWORD`**
```
Your Neon database password
```

**`STAGING_POSTGRES_DATABASE`**
```
neondb
```

**`STAGING_AUTH_URL`**
```
# Leave empty initially, update after first deployment
# Example after deployment:
https://d1234567890abc.cloudfront.net/api/auth
```

#### Staging Protection Rules (Optional)

- ☐ Required reviewers: (none for staging)
- ☐ Wait timer: 0 minutes
- ☑ Deployment branches: `main` only

### Step 2: Create Production Environment

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. Click **Configure environment**

#### Production Environment Secrets

Add these environment secrets:

**`PROD_POSTGRES_URL`**
```
Your production database connection string
```

**`PROD_POSTGRES_PRISMA_URL`**
```
Same as PROD_POSTGRES_URL
```

**`PROD_POSTGRES_URL_NON_POOLING`**
```
Production non-pooling connection
```

**`PROD_POSTGRES_USER`**
```
Production database user
```

**`PROD_POSTGRES_HOST`**
```
Production database host
```

**`PROD_POSTGRES_PASSWORD`**
```
Production database password
```

**`PROD_POSTGRES_DATABASE`**
```
Production database name
```

**`PROD_AUTH_URL`**
```
# Update after first deployment
# Example:
https://dashboard.yourdomain.com/api/auth
# Or:
https://dXXXXXXXXX.cloudfront.net/api/auth
```

#### Production Protection Rules (IMPORTANT!)

- ☑ **Required reviewers**: Add yourself and/or team members
- ☑ **Wait timer**: 5 minutes (optional)
- ☑ **Deployment branches**: `main` only
- ☑ **Prevent self-review**: Yes (if team)

**Why protection rules?**
- Prevents accidental production deployments
- Requires manual approval
- Adds safety layer

---

## Secrets Summary

### Repository Secrets (Shared)

| Secret Name              | Description                    | Example Value                  |
|--------------------------|--------------------------------|--------------------------------|
| `AWS_ACCESS_KEY_ID`      | AWS access key                | `AKIAIOSFODNN7EXAMPLE`         |
| `AWS_SECRET_ACCESS_KEY`  | AWS secret key                | `wJalrXUtnFEMI/...`            |
| `AUTH_SECRET`            | NextAuth secret (all envs)    | `uf1AnXA4lVm2hJ...`            |
| `SNYK_TOKEN`             | Snyk security (optional)      | `...`                          |

### Staging Environment Secrets

| Secret Name                       | Value Source           |
|-----------------------------------|------------------------|
| `STAGING_POSTGRES_URL`            | Neon dashboard         |
| `STAGING_POSTGRES_PRISMA_URL`     | Neon dashboard         |
| `STAGING_POSTGRES_URL_NON_POOLING`| Neon dashboard         |
| `STAGING_POSTGRES_USER`           | Neon dashboard         |
| `STAGING_POSTGRES_HOST`           | Neon dashboard         |
| `STAGING_POSTGRES_PASSWORD`       | Neon dashboard         |
| `STAGING_POSTGRES_DATABASE`       | Neon dashboard         |
| `STAGING_AUTH_URL`                | Update after deploy    |

### Production Environment Secrets

| Secret Name                  | Value Source              |
|------------------------------|---------------------------|
| `PROD_POSTGRES_URL`          | Production DB dashboard   |
| `PROD_POSTGRES_PRISMA_URL`   | Production DB dashboard   |
| `PROD_POSTGRES_URL_NON_POOLING` | Production DB dashboard |
| `PROD_POSTGRES_USER`         | Production DB dashboard   |
| `PROD_POSTGRES_HOST`         | Production DB dashboard   |
| `PROD_POSTGRES_PASSWORD`     | Production DB dashboard   |
| `PROD_POSTGRES_DATABASE`     | Production DB dashboard   |
| `PROD_AUTH_URL`              | Update after deploy       |

---

## Test the Pipeline

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add CI/CD configuration"
git push origin main
```

### Step 2: Watch GitHub Actions

1. Go to repository → **Actions** tab
2. See workflow run automatically
3. Watch each job:
   - ✓ Code Quality
   - ✓ Security Scan
   - ✓ Build
   - ⏸ Deploy to Staging (waiting)
   - ⏸ Deploy to Production (waiting)

### Step 3: Verify Jobs

**Quality Job** should:
- Run ESLint
- Run TypeScript check
- Run Prettier check

**Security Job** should:
- Run Trivy scan
- Run Snyk scan (if token provided)
- Run npm audit

**Build Job** should:
- Install dependencies
- Build Next.js app
- Verify build output

**Deploy Staging** should:
- Configure AWS credentials
- Load environment variables
- Run `sst deploy --stage staging`
- Output deployment URL

### Step 4: Check Deployment

After staging deploys:

```bash
# Get staging URL from Actions logs or:
npx sst url --stage staging
```

Visit the URL and test functionality.

---

## Update AUTH_URL After First Deploy

### Step 1: Get CloudFront URL

From GitHub Actions logs or:
```bash
npx sst url --stage staging
```

Example: `https://d1234567890abc.cloudfront.net`

### Step 2: Update GitHub Secret

1. Go to **Settings** → **Environments** → `staging`
2. Edit `STAGING_AUTH_URL`
3. Set to: `https://d1234567890abc.cloudfront.net/api/auth`
4. Save

### Step 3: Trigger Redeployment

```bash
# Make a small change and push
git commit --allow-empty -m "Redeploy with correct AUTH_URL"
git push origin main
```

Or manually trigger:
1. Go to **Actions** tab
2. Click workflow
3. Click **Run workflow**

---

## Workflow Triggers

The CI/CD pipeline runs on:

### Automatic Triggers
- ✅ **Push to main** - Full pipeline including deployments
- ✅ **Pull requests** - Quality + Security + Build only (no deploy)
- ✅ **Manual** - Via GitHub Actions UI

### Workflow Dispatch
You can manually trigger deployments:

1. Go to **Actions** tab
2. Select "Deploy Next.js Dashboard"
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"

---

## Branch Protection Rules (Recommended)

Protect the `main` branch:

1. Go to **Settings** → **Branches**
2. Add rule for `main`
3. Enable:
   - ☑ Require pull request before merging
   - ☑ Require status checks to pass
     - Select: `Code Quality`, `Security Scan`, `Build`
   - ☑ Require branches to be up to date
   - ☑ Include administrators (optional)

---

## Troubleshooting

### "Secret not found" Error

**Problem**: GitHub Actions can't find a secret

**Solution**:
1. Check secret name matches exactly (case-sensitive)
2. Verify secret is in correct scope (repository vs environment)
3. For environment secrets, check environment name in workflow

### "AWS credentials not valid" Error

**Problem**: AWS authentication fails

**Solution**:
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
2. Check IAM user has necessary permissions
3. Test credentials locally: `aws sts get-caller-identity`

### "Build failed" in CI

**Problem**: Build fails in GitHub Actions but works locally

**Solution**:
1. Check Node.js version matches (18.x)
2. Verify all dependencies are in `package.json`
3. Check for environment-specific code
4. Look at detailed error in Actions logs

### Deployment Hangs

**Problem**: Deployment job never completes

**Solution**:
1. Check timeout settings (default: 60 minutes)
2. Look for rate limiting issues
3. Check AWS service health
4. Cancel and retry

### Environment Not Accessible

**Problem**: Can't deploy to environment

**Solution**:
1. Check environment exists in Settings → Environments
2. Verify you have write access to repository
3. Check protection rules don't block you
4. Try manual workflow dispatch

---

## Security Best Practices

### ✅ DO:
- Use environment secrets for sensitive data
- Enable branch protection
- Require PR reviews for production
- Use separate AWS accounts for staging/prod (advanced)
- Rotate AWS credentials periodically
- Monitor AWS CloudTrail for API calls

### ❌ DON'T:
- Commit secrets to repository
- Use same database for staging and production
- Skip tests before deployment
- Deploy directly without PR review
- Share AWS credentials

---

## Next Steps

After setup:

1. ✅ All secrets configured
2. ✅ Environments created
3. ✅ Protection rules enabled
4. ✅ First deployment successful
5. ✅ AUTH_URL updated

Then:
- Monitor CloudWatch for errors
- Set up alerts for failures
- Create deployment schedule
- Document deployment process for team

---

## Quick Reference

### Essential Commands

```bash
# Check GitHub Actions locally (with act)
act -l

# Manually trigger workflow
# Use GitHub UI: Actions → Run workflow

# Check secrets (locally)
gh secret list

# Add secret via CLI
gh secret set SECRET_NAME
```

### Required Secrets Checklist

Repository Secrets:
- [ ] AWS_ACCESS_KEY_ID
- [ ] AWS_SECRET_ACCESS_KEY
- [ ] AUTH_SECRET
- [ ] SNYK_TOKEN (optional)

Staging Environment:
- [ ] STAGING_POSTGRES_URL
- [ ] STAGING_POSTGRES_PRISMA_URL
- [ ] STAGING_POSTGRES_URL_NON_POOLING
- [ ] STAGING_POSTGRES_USER
- [ ] STAGING_POSTGRES_HOST
- [ ] STAGING_POSTGRES_PASSWORD
- [ ] STAGING_POSTGRES_DATABASE
- [ ] STAGING_AUTH_URL (after first deploy)

Production Environment:
- [ ] PROD_POSTGRES_URL
- [ ] PROD_POSTGRES_PRISMA_URL
- [ ] PROD_POSTGRES_URL_NON_POOLING
- [ ] PROD_POSTGRES_USER
- [ ] PROD_POSTGRES_HOST
- [ ] PROD_POSTGRES_PASSWORD
- [ ] PROD_POSTGRES_DATABASE
- [ ] PROD_AUTH_URL (after first deploy)

---

**Last Updated**: October 15, 2025
**Version**: 1.0.0
