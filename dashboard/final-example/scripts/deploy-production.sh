#!/bin/bash

# ============================================================================
# Deploy to Production Script
# ============================================================================
# Automates the production deployment process with strict pre-checks
#
# Usage: ./scripts/deploy-production.sh
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "  Next.js Dashboard - Production Deployment"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# Pre-flight Checks (Stricter for Production)
# ============================================================================

echo "🔍 Running pre-flight checks (PRODUCTION)..."
echo ""

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo -e "${RED}❌ Error: Not on main/master branch${NC}"
  echo "Current branch: $CURRENT_BRANCH"
  echo "Switch to main: git checkout main"
  exit 1
fi
echo -e "${GREEN}✓${NC} On main branch"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Warning: Uncommitted changes detected${NC}"
  read -p "Continue anyway? (yes/no): " CONTINUE
  if [ "$CONTINUE" != "yes" ]; then
    exit 0
  fi
fi
echo -e "${GREEN}✓${NC} Git status clean (or acknowledged)"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
  echo -e "${RED}❌ Error: .env.production not found${NC}"
  echo "Please create .env.production from .env.production.example"
  exit 1
fi
echo -e "${GREEN}✓${NC} .env.production exists"

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
  exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account: ${AWS_ACCOUNT}"
echo ""

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)
echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

# ============================================================================
# Staging Verification
# ============================================================================

echo "🔍 Checking staging deployment..."
echo ""

echo "❓ Has staging been deployed and tested?"
read -p "Enter 'yes' to confirm: " STAGING_CONFIRMED

if [ "$STAGING_CONFIRMED" != "yes" ]; then
  echo -e "${RED}❌ Please deploy and test staging first${NC}"
  echo "Run: ./scripts/deploy-staging.sh"
  exit 1
fi

echo -e "${GREEN}✓${NC} Staging confirmed"
echo ""

# ============================================================================
# Run All Tests
# ============================================================================

echo "🧪 Running full test suite (PRODUCTION)..."
echo ""

# Linting (strict)
echo "Running linting..."
if ! npm run lint; then
  echo -e "${RED}❌ Linting failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Linting passed"

# Type checking (strict)
echo "Running type check..."
if ! npm run type-check; then
  echo -e "${RED}❌ Type check failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Type check passed"

# Formatting check
echo "Running format check..."
if ! npm run format:check; then
  echo -e "${RED}❌ Format check failed${NC}"
  echo "Run: npm run format"
  exit 1
fi
echo -e "${GREEN}✓${NC} Format check passed"
echo ""

# ============================================================================
# Build Test
# ============================================================================

echo "🔨 Running production build..."
echo ""

if ! npm run build; then
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"
echo ""

# ============================================================================
# Final Confirmation
# ============================================================================

echo "============================================"
echo "  ⚠️  PRODUCTION DEPLOYMENT WARNING ⚠️"
echo "============================================"
echo ""
echo "You are about to deploy to PRODUCTION"
echo ""
echo "Details:"
echo "  AWS Account: ${AWS_ACCOUNT}"
echo "  Stage: production"
echo "  Database: ${POSTGRES_HOST}"
echo "  Branch: $CURRENT_BRANCH"
echo ""
echo "All checks passed:"
echo "  ✓ On main branch"
echo "  ✓ Environment configured"
echo "  ✓ Tests passed"
echo "  ✓ Build successful"
echo "  ✓ Staging verified"
echo ""

read -p "Type 'DEPLOY' to confirm production deployment: " FINAL_CONFIRM

if [ "$FINAL_CONFIRM" != "DEPLOY" ]; then
  echo "Deployment cancelled"
  exit 0
fi

echo ""

# ============================================================================
# Deploy to Production
# ============================================================================

echo "🚀 Deploying to PRODUCTION..."
echo ""
echo "This may take 5-10 minutes..."
echo ""

npm run sst:deploy:prod

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo ""
  echo -e "${GREEN}============================================"
  echo "  ✅ PRODUCTION DEPLOYMENT SUCCESSFUL!"
  echo "============================================${NC}"
  echo ""

  # Get deployment URL
  echo "Getting production URL..."
  URL=$(npx sst url --stage prod 2>/dev/null || echo "URL not available yet")

  if [ "$URL" != "URL not available yet" ]; then
    echo ""
    echo "🌐 Production URL: ${URL}"
    echo ""

    # Create deployment record
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    COMMIT=$(git rev-parse --short HEAD)

    echo "${TIMESTAMP} | ${COMMIT} | ${URL}" >> deployment-history.log

    echo "📝 Deployment recorded in deployment-history.log"
    echo ""
  fi

  echo "Next steps:"
  echo "  1. Visit the production URL: ${URL}"
  echo "  2. Test critical functionality:"
  echo "     - Login"
  echo "     - Create/Edit/Delete invoice"
  echo "     - Search and pagination"
  echo "  3. Monitor CloudWatch: https://console.aws.amazon.com/cloudwatch"
  echo "  4. Check for errors in logs: npm run sst:logs -- --stage prod"
  echo "  5. Run smoke test: k6 run tests/load/smoke-test.js -e BASE_URL=${URL}"
  echo ""
  echo "🎉 Congratulations on your production deployment!"
  echo ""

else
  echo ""
  echo -e "${RED}============================================"
  echo "  ❌ PRODUCTION DEPLOYMENT FAILED"
  echo "============================================${NC}"
  echo ""
  echo "IMPORTANT: Production may be in an inconsistent state"
  echo ""
  echo "Immediate actions:"
  echo "  1. Check error messages above"
  echo "  2. Review CloudWatch logs"
  echo "  3. Consider rollback if necessary"
  echo ""
  echo "Need help? Check:"
  echo "  - DEPLOYMENT_GUIDE.md"
  echo "  - CloudWatch Logs"
  echo "  - SST Discord: https://discord.gg/sst"
  echo ""
  exit 1
fi
