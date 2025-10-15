#!/bin/bash

# ============================================================================
# Deploy to Staging Script
# ============================================================================
# Automates the staging deployment process with pre-checks
#
# Usage: ./scripts/deploy-staging.sh
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "  Next.js Dashboard - Staging Deployment"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# Pre-flight Checks
# ============================================================================

echo "🔍 Running pre-flight checks..."
echo ""

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
  echo -e "${RED}❌ Error: .env.staging not found${NC}"
  echo "Please create .env.staging from .env.staging.example"
  exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo -e "${RED}❌ Error: AWS credentials not configured${NC}"
  echo "Run: aws configure"
  exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account: ${AWS_ACCOUNT}"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js: ${NODE_VERSION}"
echo ""

# Load environment variables
echo "Loading environment variables..."
export $(cat .env.staging | grep -v '^#' | xargs)
echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

# ============================================================================
# Run Tests
# ============================================================================

echo "🧪 Running tests..."
echo ""

# Linting
echo "Running linting..."
if ! npm run lint > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Linting warnings detected (continuing anyway)${NC}"
else
  echo -e "${GREEN}✓${NC} Linting passed"
fi

# Type checking
echo "Running type check..."
if ! npm run type-check > /dev/null 2>&1; then
  echo -e "${RED}❌ Type check failed${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Type check passed"
echo ""

# ============================================================================
# Build Test
# ============================================================================

echo "🔨 Testing build..."
echo ""

if ! npm run build > /dev/null 2>&1; then
  echo -e "${RED}❌ Build failed${NC}"
  echo "Please fix build errors before deploying"
  exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"
echo ""

# ============================================================================
# Deployment Confirmation
# ============================================================================

echo "=========================================="
echo "Ready to deploy to STAGING"
echo "=========================================="
echo "AWS Account: ${AWS_ACCOUNT}"
echo "Stage: staging"
echo "Database: ${POSTGRES_HOST}"
echo ""

read -p "Continue with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Deployment cancelled"
  exit 0
fi

echo ""

# ============================================================================
# Deploy
# ============================================================================

echo "🚀 Deploying to staging..."
echo ""

npm run sst:deploy:staging

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo ""
  echo -e "${GREEN}=========================================="
  echo "  ✅ Deployment Successful!"
  echo "==========================================${NC}"
  echo ""

  # Get deployment URL
  echo "Getting deployment URL..."
  URL=$(npx sst url --stage staging 2>/dev/null || echo "URL not available yet")

  if [ "$URL" != "URL not available yet" ]; then
    echo ""
    echo "🌐 Staging URL: ${URL}"
    echo ""
    echo "⚠️  IMPORTANT: Update AUTH_URL in .env.staging:"
    echo "   AUTH_URL=\"${URL}/api/auth\""
    echo ""
    echo "Then run: ./scripts/deploy-staging.sh again"
  fi

  echo ""
  echo "Next steps:"
  echo "  1. Visit the staging URL"
  echo "  2. Test login and functionality"
  echo "  3. Run smoke tests: k6 run tests/load/smoke-test.js -e BASE_URL=${URL}"
  echo "  4. Check CloudWatch logs: npm run sst:logs"
  echo ""

else
  echo ""
  echo -e "${RED}=========================================="
  echo "  ❌ Deployment Failed"
  echo "==========================================${NC}"
  echo ""
  echo "Check the error messages above"
  echo "Common issues:"
  echo "  - AWS permissions"
  echo "  - Environment variables"
  echo "  - Build errors"
  echo ""
  exit 1
fi
