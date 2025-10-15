# Rollback Guide

Emergency procedures for rolling back deployments when issues occur.

---

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Quick Rollback](#quick-rollback)
3. [Detailed Rollback Procedures](#detailed-rollback-procedures)
4. [Post-Rollback Actions](#post-rollback-actions)
5. [Prevention](#prevention)

---

## When to Rollback

### Critical Issues (Immediate Rollback Required)

- ❌ **Application completely down** (500 errors on all pages)
- ❌ **Database errors** preventing all operations
- ❌ **Authentication broken** (nobody can log in)
- ❌ **Data corruption** occurring
- ❌ **Security vulnerability** discovered

### Non-Critical Issues (Fix Forward Instead)

- ⚠️  Minor UI bugs
- ⚠️  Slow performance (not crashing)
- ⚠️  Single feature broken
- ⚠️  Cosmetic issues

**Rule**: If it's breaking core functionality and can't be fixed quickly (< 30 min), rollback.

---

## Quick Rollback

### Option 1: Redeploy Previous Version (Fastest)

```bash
# 1. Find last working commit
git log --oneline -10

# Example output:
# abc1234 (HEAD) Fix invoice bug     ← Current (broken)
# def5678 Add new feature            ← Last known good
# ghi9012 Update styles

# 2. Checkout last working commit
git checkout def5678

# 3. Redeploy immediately
export $(cat .env.production | xargs)
npm run sst:deploy:prod

# 4. Verify rollback
./scripts/verify-deployment.sh $(npx sst url --stage prod)

# 5. Return to main branch (after verification)
git checkout main
```

**Time**: 5-10 minutes

### Option 2: Use Git Revert

```bash
# 1. Revert the problematic commit(s)
git revert abc1234

# 2. Push to main
git push origin main

# 3. GitHub Actions will auto-deploy
# Or deploy manually:
export $(cat .env.production | xargs)
npm run sst:deploy:prod
```

**Time**: 5-15 minutes (includes CI/CD)

---

## Detailed Rollback Procedures

### Scenario 1: Recent Deployment Failed

**Situation**: Just deployed and it's broken.

**Steps**:

1. **Identify Issue**
```bash
# Check logs
npx sst logs --stage prod --tail

# Check CloudWatch
# Go to: https://console.aws.amazon.com/cloudwatch
```

2. **Find Last Working Version**
```bash
# Check deployment history
cat deployment-history.log

# Or check git log
git log --oneline --all
```

3. **Rollback**
```bash
# Checkout previous version
git checkout <previous-commit>

# Verify it builds
npm run build

# Deploy
export $(cat .env.production | xargs)
npm run sst:deploy:prod
```

4. **Verify**
```bash
# Get URL
URL=$(npx sst url --stage prod)

# Run verification
./scripts/verify-deployment.sh $URL

# Manual test
# Visit URL and test critical flows
```

5. **Notify Team**
```
# Post to Slack/Discord/Email:
Production rolled back to version <commit-hash>
Reason: <brief description>
Status: Investigating issue
ETA for fix: <estimate>
```

### Scenario 2: Issue Discovered Hours Later

**Situation**: Deployed successfully but issue found later.

**Steps**:

1. **Assess Impact**
```bash
# How many users affected?
# Check CloudWatch metrics: error rate, user activity

# Is it getting worse?
# Monitor error trends
```

2. **Decision Matrix**

| Impact | Frequency | Action |
|--------|-----------|--------|
| High | Often | **Rollback immediately** |
| High | Rare | Rollback or quick fix |
| Low | Often | Quick fix preferred |
| Low | Rare | Fix forward |

3. **If Rolling Back**:
```bash
# Find last stable version
git log --since="24 hours ago" --oneline

# Rollback
git checkout <stable-commit>
npm run sst:deploy:prod
```

4. **Communication**:
- Notify users (if customer-facing)
- Update status page
- Post-mortem after resolution

### Scenario 3: Database Migration Issue

**Situation**: Database migration broke something.

**Steps**:

1. **DO NOT rollback deployment immediately**
   - Database migrations are stateful
   - Rollback might cause data inconsistency

2. **Check Migration Status**
```bash
# SSH to server or run locally pointing to prod DB
npm run db:status

# Check what migrations ran
```

3. **Options**:

**Option A**: Rollback migration
```bash
# Only if safe to do so!
npm run db:rollback

# Then rollback deployment
git checkout <previous-commit>
npm run sst:deploy:prod
```

**Option B**: Fix forward
```bash
# Write a fix migration
# Deploy fix immediately
```

**Option C**: Restore from backup
```bash
# If data corruption occurred
# Restore database from last backup
# Then rollback deployment
```

4. **Prevent Data Loss**:
- Always test migrations on staging first
- Take database backup before prod migration
- Make migrations reversible

### Scenario 4: CloudFront/CDN Issues

**Situation**: Static assets not loading, cached old version.

**Steps**:

1. **Invalidate CloudFront Cache**
```bash
# Get CloudFront distribution ID
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,Origins.Items[0].DomainName]"

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id <ID> \
  --paths "/*"
```

2. **Wait for Invalidation** (usually 5-15 minutes)

3. **Test Again**
```bash
# Clear browser cache
# Test in incognito mode
# Verify assets load
```

4. **If Still Broken**:
```bash
# Rollback deployment
git checkout <previous-commit>
npm run sst:deploy:prod
```

---

## Post-Rollback Actions

### Immediate (Within 1 Hour)

- [ ] ✅ Verify rollback successful
- [ ] ✅ Monitor error rates (should decrease)
- [ ] ✅ Test critical user flows
- [ ] ✅ Communicate status to team
- [ ] ✅ Check database integrity

### Short-term (Within 24 Hours)

- [ ] 📝 Document what went wrong
- [ ] 🐛 Create bug ticket for the issue
- [ ] 🔍 Review logs and find root cause
- [ ] ✍️ Write fix (on a branch)
- [ ] 🧪 Test fix thoroughly
- [ ] 👀 Code review the fix

### Long-term (Within 1 Week)

- [ ] 📊 Post-mortem meeting
- [ ] 📋 Update deployment checklist
- [ ] 🧪 Add tests to catch this issue
- [ ] 📚 Update documentation
- [ ] 🔧 Improve deployment process

### Post-Mortem Template

```markdown
# Incident Post-Mortem

**Date**: 2025-10-15
**Duration**: 2 hours
**Impact**: High / Medium / Low

## What Happened
- Timeline of events
- What was deployed
- What broke

## Root Cause
- Technical explanation
- Why didn't we catch this?

## Resolution
- How we fixed it
- Time to resolution

## Action Items
- [ ] Add test for X
- [ ] Update deployment checklist
- [ ] Improve monitoring for Y

## Lessons Learned
- What went well
- What could be better
```

---

## Prevention

### Before Deploying

**Staging First**:
- ✅ Always deploy to staging first
- ✅ Run full test suite
- ✅ Manual testing on staging
- ✅ Load test on staging
- ✅ Wait at least 1 hour before prod

**Pre-Deployment Checklist**:
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Staging deployed and tested
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Team notified
- [ ] Monitoring ready

**Database Migrations**:
- [ ] Tested on staging
- [ ] Backup created
- [ ] Reversible (has `down` migration)
- [ ] Won't break existing code
- [ ] Doesn't lock tables for long

### During Deployment

**Monitor Closely**:
```bash
# Watch logs
npx sst logs --stage prod --tail

# Watch metrics
# CloudWatch → Dashboards → nextjs-dashboard-prod

# Watch error rates
# Check for spikes in errors
```

**Gradual Rollout** (Advanced):
- Deploy to subset of users first
- Monitor for issues
- Gradually increase traffic
- Full rollout if stable

### After Deployment

**Verification**:
```bash
# Run automated checks
./scripts/verify-deployment.sh $(npx sst url --stage prod)

# Manual testing
# Test critical flows:
#  1. Login
#  2. Create invoice
#  3. Edit invoice
#  4. Search
#  5. Pagination
```

**Monitoring Period**:
- Watch for 30 minutes minimum
- Check error rates
- Check response times
- Check user activity
- Be ready to rollback

**Communication**:
- Announce deployment complete
- Share deployment URL
- Note any known issues
- Provide contact for bugs

---

## Rollback Decision Tree

```
Issue detected
     │
     ├─ Is production completely down?
     │       └─ YES → Rollback immediately
     │
     ├─ Is core functionality broken?
     │       └─ YES → Can you fix in < 30 min?
     │               ├─ YES → Fix forward
     │               └─ NO → Rollback
     │
     └─ Is it a minor bug?
             └─ Fix forward
```

---

## Emergency Contacts

**On-Call Rotation**:
- Primary: [Your name / phone]
- Secondary: [Teammate / phone]
- Escalation: [Manager / phone]

**AWS Support**:
- Portal: https://console.aws.amazon.com/support
- Phone: See AWS console

**Database Provider (Neon)**:
- Support: https://console.neon.tech
- Discord: https://discord.gg/neon

**SST Discord**:
- https://discord.gg/sst

---

## Tools & Commands Reference

### Check Deployment Status
```bash
# Get current version
npx sst url --stage prod

# View logs
npx sst logs --stage prod --tail

# Check resources
npx sst console --stage prod
```

### Git Commands
```bash
# Find commits
git log --oneline -20

# Checkout specific version
git checkout <commit-hash>

# Create rollback commit
git revert <commit-hash>

# Return to main
git checkout main
```

### AWS Commands
```bash
# Check Lambda functions
aws lambda list-functions

# View CloudWatch logs
aws logs tail /aws/lambda/<function-name> --follow

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Verification
```bash
# Automated verification
./scripts/verify-deployment.sh <URL>

# Load test
k6 run tests/load/smoke-test.js -e BASE_URL=<URL>
```

---

## Rollback Checklist

When rolling back:

- [ ] Identify the issue clearly
- [ ] Find last known good version
- [ ] Notify team of rollback
- [ ] Checkout previous version
- [ ] Run build test locally
- [ ] Deploy to production
- [ ] Verify rollback successful
- [ ] Monitor for stability
- [ ] Update status page
- [ ] Document incident
- [ ] Plan fix
- [ ] Schedule post-mortem

---

**Remember**: It's better to rollback quickly and fix properly than to keep a broken deployment running.

**Last Updated**: October 15, 2025
