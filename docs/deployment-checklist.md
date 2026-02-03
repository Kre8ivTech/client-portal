# Production Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] TypeScript strict mode enabled
- [x] No TypeScript errors (`npm run type-check`)
- [x] ESLint passing (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [ ] All tests passing (`npm test && npm run test:e2e`)
- [x] Code reviewed and approved

### ✅ Environment Configuration
- [x] `.env.example` documented with all required variables
- [ ] Production environment variables set in Vercel
- [ ] Supabase production project created
- [ ] Database migrations applied to production
- [ ] RLS policies verified in production

### ✅ Security
- [x] No secrets committed to repository
- [x] `SUPABASE_SERVICE_ROLE_KEY` only used server-side
- [x] RLS enabled on all tables
- [ ] CORS configured correctly
- [ ] Rate limiting configured
- [ ] Security headers configured

### ✅ Database
- [x] All migrations in `/supabase/migrations/`
- [ ] Migrations tested on staging environment
- [ ] Backup strategy in place
- [ ] Connection pooling configured (via Supabase)

### ✅ Third-Party Services
- [ ] Stripe production keys configured
- [ ] Stripe webhooks pointing to production URL
- [ ] DocuSign production account configured
- [ ] Resend API key configured
- [ ] Email templates tested
- [ ] OAuth apps configured for production URLs

## Deployment Steps

### 1. Set Up Vercel Project

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Link project to Vercel
vercel link

# Set environment variables (Runtime)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add RESEND_API_KEY production
vercel env add NEXT_PUBLIC_APP_URL production

# Set build-time environment variables (for migrations)
vercel env add SUPABASE_ACCESS_TOKEN production
vercel env add SUPABASE_PROJECT_REF production
vercel env add SUPABASE_DB_PASSWORD production
```

### How to Get Supabase Credentials

**SUPABASE_ACCESS_TOKEN:**
1. Go to https://supabase.com/dashboard/account/tokens
2. Generate a new access token
3. Copy and save it securely

**SUPABASE_PROJECT_REF:**
1. Go to your Supabase project dashboard
2. Click Settings → General
3. Copy the "Reference ID"

**SUPABASE_DB_PASSWORD:**
1. Go to your Supabase project dashboard
2. Click Settings → Database
3. Use the password you set when creating the project
4. If forgotten, you can reset it in the database settings

### 2. Configure Supabase Production

**Option A: Automatic Migrations (Recommended)**

Migrations run automatically during Vercel build process. Just ensure you have:
- `SUPABASE_ACCESS_TOKEN` in Vercel environment variables
- `SUPABASE_PROJECT_REF` in Vercel environment variables
- `SUPABASE_DB_PASSWORD` in Vercel environment variables

The `npm run build` command will automatically run migrations before building.

**Option B: Manual Migrations**

If you prefer to run migrations manually:

```bash
# Connect to production project locally
supabase link --project-ref <your-project-ref>

# Push migrations
supabase db push

# Verify RLS policies
supabase db remote list
```

**Note:** For preview deployments, migrations are skipped to avoid conflicts.

### 3. Configure Webhooks

**Stripe Webhooks:**
- URL: `https://your-domain.com/api/webhooks/stripe`
- Events to listen for:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `invoice.paid`
  - `invoice.payment_failed`

**DocuSign Webhooks:**
- URL: `https://your-domain.com/api/webhooks/docusign`
- Events: envelope completed, signed, declined, voided

### 4. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git push origin main
```

## Post-Deployment Verification

### Immediate Checks
- [ ] Application loads at production URL
- [ ] Login/signup works
- [ ] Database connection working
- [ ] Real-time features working (tickets, messages)
- [ ] File uploads working (Supabase Storage)
- [ ] Email sending works (test with Resend)
- [ ] Webhook endpoints accessible

### Functional Testing
- [ ] Create a test user
- [ ] Submit a test ticket
- [ ] Create a test invoice
- [ ] Send a test message
- [ ] Upload a test file
- [ ] Test payment flow (Stripe test mode first)

### Performance Testing
- [ ] Run Lighthouse audit (target: >90 score)
- [ ] Check Core Web Vitals in Vercel Analytics
- [ ] Test on mobile devices
- [ ] Test on slow 3G connection

### Security Testing
- [ ] Verify RLS is working (try accessing other org's data)
- [ ] Test authentication flows
- [ ] Verify rate limiting
- [ ] Check HTTPS is enforced
- [ ] Verify security headers

## Monitoring Setup

### Vercel Dashboard
- Enable Analytics
- Configure Error Tracking
- Set up Deployment Protection (if needed)

### Supabase Dashboard
- Enable Database Health monitoring
- Configure Auth Hooks (if needed)
- Review Storage quotas

### Alerts
Set up alerts for:
- Error rate threshold
- Response time degradation
- Database connection issues
- Storage quota warnings

## Rollback Plan

If issues are detected:

```bash
# Rollback to previous deployment
vercel rollback <deployment-url>

# Or redeploy previous version
git revert HEAD
git push origin main
```

## Environment Variables Reference

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Server-side only!

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Email
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://portal.ktportal.app
NODE_ENV=production
```

### Optional Variables

```bash
# DocuSign
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_ACCOUNT_ID=...
DOCUSIGN_WEBHOOK_SECRET=...

# AWS S3 (if using separate S3 instead of Supabase Storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_REGION=us-east-1

# Analytics
NEXT_PUBLIC_GA_ID=G-... # Google Analytics
```

## DNS Configuration

### Custom Domain Setup

1. **In Vercel:**
   - Add custom domain
   - Follow DNS verification steps

2. **DNS Records:**
   ```
   A Record: @ → 76.76.21.21
   CNAME: www → cname.vercel-dns.com
   ```

3. **SSL Certificate:**
   - Automatically provisioned by Vercel
   - Verify HTTPS works

## Performance Configuration

### Vercel Settings
- Enable Edge Network
- Configure caching rules
- Enable compression
- Set up CDN

### Next.js Configuration
Already configured in `next.config.mjs`:
```javascript
// Optimal settings are in place
```

## Backup Strategy

### Database Backups
- Supabase provides daily automatic backups
- Set up manual backup before major changes:
  ```bash
  supabase db dump -f backup-$(date +%Y%m%d).sql
  ```

### Code Backups
- Git repository is the source of truth
- Tag releases:
  ```bash
  git tag -a v2.0.0 -m "Production release v2.0.0"
  git push origin v2.0.0
  ```

## Incident Response

### If Production Goes Down

1. **Check Vercel Status:** https://www.vercel-status.com/
2. **Check Supabase Status:** https://status.supabase.com/
3. **Review Recent Deployments:** Vercel dashboard
4. **Check Error Logs:** Vercel Functions logs
5. **Rollback if Needed:** See rollback plan above

### Contact Information
- Vercel Support: support@vercel.com
- Supabase Support: support@supabase.com
- Stripe Support: https://support.stripe.com

## Scaling Considerations

### Current Limits (Default)
- Vercel: 100GB bandwidth/month (Pro plan)
- Supabase: 8GB database, 100GB bandwidth
- If limits exceeded, upgrade plans

### When to Scale
- Monitor Vercel Analytics for traffic patterns
- Watch Supabase database size
- Review connection pool usage

## Compliance

### GDPR Compliance
- [ ] Data export functionality implemented
- [ ] Data deletion functionality implemented
- [ ] Privacy policy updated
- [ ] Cookie consent implemented (if needed)

### Security Compliance
- [ ] Regular security audits scheduled
- [ ] Vulnerability scanning enabled
- [ ] Dependency updates automated (Dependabot)

## Launch Communication

- [ ] Notify users of launch
- [ ] Update documentation links
- [ ] Announce new features
- [ ] Prepare support team

## Post-Launch Monitoring (First 24 Hours)

- [ ] Monitor error rates every hour
- [ ] Check server response times
- [ ] Review user feedback
- [ ] Monitor database performance
- [ ] Check webhook delivery success rates

---

## Deployment Environments

### Development
- **URL:** http://localhost:3000
- **Database:** Local Supabase
- **Purpose:** Feature development

### Staging (Optional)
- **URL:** https://staging.ktportal.app
- **Database:** Supabase staging project
- **Purpose:** Pre-production testing

### Production
- **URL:** https://portal.ktportal.app
- **Database:** Supabase production project
- **Purpose:** Live application

---

**Last Updated:** February 2, 2026
**Status:** ✅ Ready for deployment with checklist completion
