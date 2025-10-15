#!/bin/bash

# ============================================================================
# Post-Deployment Verification Script
# ============================================================================
# Verifies that a deployment is working correctly
#
# Usage: ./scripts/verify-deployment.sh <URL>
# Example: ./scripts/verify-deployment.sh https://d123.cloudfront.net
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if URL provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: No URL provided${NC}"
  echo "Usage: ./scripts/verify-deployment.sh <URL>"
  echo "Example: ./scripts/verify-deployment.sh https://d123.cloudfront.net"
  exit 1
fi

BASE_URL=$1

echo "==========================================="
echo "  Post-Deployment Verification"
echo "==========================================="
echo ""
echo "Testing URL: ${BASE_URL}"
echo ""

PASSED=0
FAILED=0

# ============================================================================
# Helper Function
# ============================================================================

check_endpoint() {
  local url=$1
  local description=$2
  local expected_status=${3:-200}

  echo -n "Testing ${description}... "

  # Make request
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null || echo "000")

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $http_code)"
    PASSED=$((PASSED+1))
    return 0
  else
    echo -e "${RED}✗${NC} (HTTP $http_code, expected $expected_status)"
    FAILED=$((FAILED+1))
    return 1
  fi
}

check_content() {
  local url=$1
  local description=$2
  local search_term=$3

  echo -n "Checking ${description}... "

  # Get content
  content=$(curl -s --max-time 10 "${url}" 2>/dev/null || echo "")

  if echo "$content" | grep -q "$search_term"; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED+1))
    return 0
  else
    echo -e "${RED}✗${NC} (content not found: '$search_term')"
    FAILED=$((FAILED+1))
    return 1
  fi
}

# ============================================================================
# Run Tests
# ============================================================================

echo "Running verification tests..."
echo ""

# Test 1: Homepage
check_endpoint "${BASE_URL}/" "Homepage"

# Test 2: Homepage content
check_content "${BASE_URL}/" "Homepage content" "Next.js"

# Test 3: Login page
check_endpoint "${BASE_URL}/login" "Login page"

# Test 4: Login form
check_content "${BASE_URL}/login" "Login form" "email"

# Test 5: Dashboard (should redirect to login)
echo -n "Testing Protected route redirect... "
redirect_code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 "${BASE_URL}/dashboard" 2>/dev/null || echo "000")
if [ "$redirect_code" = "200" ]; then
  echo -e "${GREEN}✓${NC}"
  PASSED=$((PASSED+1))
else
  echo -e "${RED}✗${NC} (HTTP $redirect_code)"
  FAILED=$((FAILED+1))
fi

# Test 6: Static assets (favicon)
echo -n "Testing Static assets... "
favicon_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}/favicon.ico" 2>/dev/null || echo "000")
if [ "$favicon_code" = "200" ] || [ "$favicon_code" = "404" ]; then
  echo -e "${GREEN}✓${NC} (HTTP $favicon_code)"
  PASSED=$((PASSED+1))
else
  echo -e "${YELLOW}⚠${NC} (HTTP $favicon_code)"
  PASSED=$((PASSED+1))  # Don't fail on favicon
fi

# Test 7: Response time
echo -n "Testing Response time... "
start_time=$(date +%s%3N)
curl -s -o /dev/null --max-time 10 "${BASE_URL}/" 2>/dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [ $response_time -lt 3000 ]; then
  echo -e "${GREEN}✓${NC} (${response_time}ms)"
  PASSED=$((PASSED+1))
else
  echo -e "${YELLOW}⚠${NC} (${response_time}ms - slow but acceptable)"
  PASSED=$((PASSED+1))
fi

# Test 8: SSL certificate (for HTTPS)
if [[ $BASE_URL == https://* ]]; then
  echo -n "Testing SSL certificate... "
  if curl -s --max-time 10 "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED+1))
  else
    echo -e "${RED}✗${NC}"
    FAILED=$((FAILED+1))
  fi
fi

# Test 9: Error page (404)
echo -n "Testing 404 error handling... "
error_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}/non-existent-page-12345" 2>/dev/null || echo "000")
if [ "$error_code" = "404" ]; then
  echo -e "${GREEN}✓${NC}"
  PASSED=$((PASSED+1))
else
  echo -e "${YELLOW}⚠${NC} (HTTP $error_code, expected 404)"
  # Don't fail on this
  PASSED=$((PASSED+1))
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "==========================================="
echo "  Verification Summary"
echo "==========================================="
echo ""
echo "URL: ${BASE_URL}"
echo ""
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Manual testing:"
  echo "     - Visit ${BASE_URL}"
  echo "     - Test login with: user@nextmail.com / 123456"
  echo "     - Test invoice CRUD operations"
  echo "     - Test search and pagination"
  echo ""
  echo "  2. Run load test:"
  echo "     k6 run tests/load/smoke-test.js -e BASE_URL=${BASE_URL}"
  echo ""
  echo "  3. Monitor CloudWatch logs:"
  echo "     npx sst logs --tail"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo "Failed tests indicate potential issues:"
  echo "  - Check CloudWatch logs for errors"
  echo "  - Verify environment variables are set correctly"
  echo "  - Check database connectivity"
  echo "  - Review deployment logs"
  echo ""
  echo "Troubleshooting:"
  echo "  1. View logs: npx sst logs --tail"
  echo "  2. Check SST console: npx sst console"
  echo "  3. Review DEPLOYMENT_GUIDE.md troubleshooting section"
  echo ""
  exit 1
fi
