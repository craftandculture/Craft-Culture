# Staging Environment Setup Plan

> **Status:** Planning
> **Goal:** Set up isolated staging environment to test changes before production

---

## Decisions Made

| Question | Decision |
|----------|----------|
| **Domain** | `staging.craftculture.xyz` |
| **Email** | Separate Loops test account |
| **Data Refresh** | Regular (weekly sync from prod) |

---

## Current State

| Component | Production | Notes |
|-----------|------------|-------|
| **Vercel** | craftculture.xyz | Single project, deploys from `main` |
| **Neon DB** | `main` branch | Project: `little-river-49556671` |
| **Email** | Loops.so | Production API key |
| **Errors** | Sentry | Single DSN |

---

## Proposed Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      GitHub                             │
                    │                                                         │
                    │   main branch ──────────────► staging branch            │
                    │        │                            │                   │
                    └────────┼────────────────────────────┼───────────────────┘
                             │                            │
                             ▼                            ▼
                    ┌─────────────────┐          ┌─────────────────┐
                    │     VERCEL      │          │     VERCEL      │
                    │   Production    │          │     Staging     │
                    │                 │          │                 │
                    │ craftculture.xyz│          │ staging.craftculture.xyz
                    └────────┬────────┘          └────────┬────────┘
                             │                            │
                             ▼                            ▼
                    ┌─────────────────┐          ┌─────────────────┐
                    │    NEON DB      │          │    NEON DB      │
                    │  main branch    │          │  staging branch │
                    │                 │          │                 │
                    │  (Production)   │          │  (Copy of prod) │
                    └─────────────────┘          └─────────────────┘
```

---

## Step-by-Step Plan

### Phase 1: Database (Neon)

**Effort:** ~15 minutes

| Step | Action | Details |
|------|--------|---------|
| 1.1 | Create `staging` branch | Branch from `main` with current data |
| 1.2 | Get connection string | New DB_URL for staging |
| 1.3 | Test connection | Verify branch is accessible |

**Neon branching benefits:**
- Instant copy of production data
- Isolated - changes don't affect prod
- Can reset to prod state anytime
- No additional cost (within limits)

---

### Phase 2: Vercel Environment

**Option A: Separate Project** (Recommended)
| Step | Action | Details |
|------|--------|---------|
| 2.1 | Create new Vercel project | Name: `craft-culture-staging` |
| 2.2 | Connect to same repo | Deploy from `staging` branch |
| 2.3 | Add custom domain | `staging.craftculture.xyz` |
| 2.4 | Configure env vars | Point to staging database |

**Option B: Preview Deployments + Branch**
| Step | Action | Details |
|------|--------|---------|
| 2.1 | Create `staging` git branch | `git checkout -b staging` |
| 2.2 | Configure branch env vars | In Vercel project settings |
| 2.3 | Push to staging | Vercel auto-deploys preview |

**Recommendation:** Option A gives you a stable URL (`demo.craftculture.xyz`) vs changing preview URLs.

---

### Phase 3: Environment Variables

**Variables to configure for staging:**

| Variable | Action | Notes |
|----------|--------|-------|
| `DB_URL` | **New value** | Staging branch connection string |
| `BETTER_AUTH_SECRET` | **New value** | Generate new: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **New value** | Generate new: `openssl rand -base64 32` |
| `LOOPS_API_KEY` | **New value** | Separate test account API key |
| `NEXT_PUBLIC_APP_URL` | **New value** | `https://staging.craftculture.xyz` |
| `SENTRY_DSN` | **Same or new** | Can use same, filter by environment |
| `NODE_ENV` | `preview` | Distinguish from production |

**Security note:** New secrets mean staging sessions/tokens won't work in production and vice versa.

---

### Phase 4: External Services

| Service | Action Required | Notes |
|---------|-----------------|-------|
| **Loops.so** | **Create test account** | Separate account for staging emails |
| **Sentry** | Optional | Add `environment: staging` tag |
| **Trigger.dev** | Consider | May want separate project to avoid duplicate jobs |

**Loops setup:**
1. Create new Loops account for staging (e.g., staging@craftculture.xyz)
2. Duplicate email templates from production account
3. Use staging API key in staging environment
4. Emails go to real addresses but from staging account (can track separately)

---

### Phase 5: DNS Configuration

| Record | Type | Value |
|--------|------|-------|
| `staging.craftculture.xyz` | CNAME | `cname.vercel-dns.com` |

Configure in your domain registrar (wherever craftculture.xyz DNS is managed).

---

## Development Workflow

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

     LOCAL                       STAGING                      PRODUCTION
  ┌──────────┐              ┌──────────────┐              ┌──────────────┐
  │          │              │              │              │              │
  │  Your    │   push to    │   staging.   │  merge to    │ craftculture │
  │ Machine  │ ──────────►  │ craftculture │ ──────────►  │    .xyz      │
  │          │   staging    │    .xyz      │    main      │              │
  │          │              │              │              │              │
  └──────────┘              └──────────────┘              └──────────────┘
       │                           │                            │
       │                           │                            │
       ▼                           ▼                            ▼
  Local DB or              Staging DB                    Production DB
  Staging DB               (copy of prod)                (real users)
```

### Step-by-Step Flow

| Step | What You Do | What Happens | Environment |
|------|-------------|--------------|-------------|
| 1 | Develop feature locally | Code on your machine | Local |
| 2 | Test locally | Run `pnpm dev` | localhost:3000 |
| 3 | Push to `staging` branch | Vercel auto-deploys | staging.craftculture.xyz |
| 4 | Test on staging site | Verify with staging data | Staging DB |
| 5 | Fix issues if needed | Repeat steps 1-4 | — |
| 6 | Merge `staging` → `main` | Vercel auto-deploys | craftculture.xyz |
| 7 | Verify in production | Quick smoke test | Production |

### Git Commands

```bash
# Start new feature
git checkout staging
git pull origin staging
git checkout -b feature/my-feature

# Develop and commit
git add .
git commit -m "feat: add new feature"

# Push to staging for testing
git checkout staging
git merge feature/my-feature
git push origin staging
# → Auto-deploys to staging.craftculture.xyz

# After testing, promote to production
git checkout main
git merge staging
git push origin main
# → Auto-deploys to craftculture.xyz
```

### Branch Strategy

```
main (production)
  │
  └── staging (demo)
        │
        ├── feature/add-inventory-page
        ├── feature/fix-pricing-bug
        └── feature/partner-support-docs
```

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code | craftculture.xyz |
| `staging` | Integration testing | demo.craftculture.xyz |
| `feature/*` | Individual features | Local only (or PR previews) |

### Safety Benefits

| Risk | How Demo Prevents It |
|------|---------------------|
| Breaking production | Test on demo first with real data |
| Bad migrations | Run against staging DB, verify before prod |
| Auth issues | Test login flows without affecting real users |
| Payment bugs | Safe environment to test order flows |
| UI regressions | Full testing before users see changes |

### When to Skip Staging

For truly trivial changes, you can push directly to main:
- Typo fixes in docs
- Copy changes (text updates)
- README updates

For everything else → **always go through staging first**.

---

## Data Management

### Initial Setup
- Staging branch starts as copy of production
- All users, orders, products copied

### Ongoing Data Sync (Weekly)

| Day | Action | How |
|-----|--------|-----|
| **Monday** | Reset staging DB from prod | Neon: Reset from parent |
| **Tues-Fri** | Accumulate test data | Normal development |
| **Weekend** | Leave as-is | No action needed |

**To reset staging database:**
1. Go to Neon Console → Project → Branches
2. Select `staging` branch
3. Click "Reset from parent"
4. Confirm (takes ~30 seconds)

### Test Accounts
Consider creating dedicated test accounts:
- `demo-partner@craftculture.xyz` - Partner user
- `demo-admin@craftculture.xyz` - Admin user
- `demo-b2c@craftculture.xyz` - Pocket Cellar user

---

## Cost Implications

| Service | Additional Cost |
|---------|-----------------|
| **Neon** | Free (branches included in plan) |
| **Vercel** | Free (Pro plan includes multiple projects) |
| **Loops** | Possibly (if high email volume) |
| **Sentry** | No (same project, different environment tag) |

---

## Rollback Plan

If staging environment causes issues:
1. Delete Vercel staging project
2. Delete Neon staging branch
3. Remove DNS record

No impact on production.

---

## Checklist

- [ ] Create Neon `staging` branch
- [ ] Get staging DB connection string
- [ ] Create Loops test account
- [ ] Duplicate email templates in Loops
- [ ] Create Vercel staging project
- [ ] Configure staging environment variables
- [ ] Add `staging.craftculture.xyz` domain
- [ ] Configure DNS CNAME record
- [ ] Test authentication flow (magic link emails)
- [ ] Test database operations
- [ ] Create test user accounts
- [ ] Document staging URLs for team
- [ ] Set up weekly DB refresh reminder

---

## Remaining Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| **Staging password protection** | Yes / No | Optional - adds friction but prevents accidental use |
| **Trigger.dev** | Share / Separate | Separate recommended to avoid duplicate jobs |

