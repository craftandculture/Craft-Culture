# Demo Environment Setup Plan

> **Status:** Planning
> **Goal:** Set up isolated demo/staging environment to test changes before production

---

## Current State

| Component | Production | Notes |
|-----------|------------|-------|
| **Vercel** | craftculture.xyz | Single project, deploys from `main` |
| **Neon DB** | `main` branch | Project: `little-river-49556671` |
| **Email** | Loops.so | Single API key |
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
                    │ craftculture.xyz│          │ demo.craftculture.xyz
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
| 2.1 | Create new Vercel project | Name: `craft-culture-demo` |
| 2.2 | Connect to same repo | Deploy from `staging` branch |
| 2.3 | Add custom domain | `demo.craftculture.xyz` |
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
| `LOOPS_API_KEY` | **Same or new** | Same key works, or create test key |
| `NEXT_PUBLIC_APP_URL` | **New value** | `https://demo.craftculture.xyz` |
| `SENTRY_DSN` | **Same or new** | Can use same, filter by environment |
| `NODE_ENV` | `preview` | Distinguish from production |

**Security note:** New secrets mean staging sessions/tokens won't work in production and vice versa.

---

### Phase 4: External Services

| Service | Action Required | Notes |
|---------|-----------------|-------|
| **Loops.so** | Optional | Same API key works; emails send normally |
| **Sentry** | Optional | Add `environment: staging` tag |
| **Trigger.dev** | Consider | May want separate project to avoid duplicate jobs |

**Loops consideration:** Magic link emails will still send. Options:
1. Use same key (emails work, but go to real addresses)
2. Create test account in Loops (recommended for heavy testing)
3. Use email interception service like Mailpit for local

---

### Phase 5: DNS Configuration

| Record | Type | Value |
|--------|------|-------|
| `demo.craftculture.xyz` | CNAME | `cname.vercel-dns.com` |

Configure in your domain registrar (wherever craftculture.xyz DNS is managed).

---

## Workflow After Setup

```
Developer Workflow:
───────────────────

1. Work on feature branch locally
   └── Test against local DB or staging DB

2. Push to staging branch
   └── Auto-deploys to demo.craftculture.xyz
   └── Test with real-ish data

3. Merge staging → main
   └── Auto-deploys to craftculture.xyz (production)
```

---

## Data Management

### Initial Setup
- Staging branch starts as copy of production
- All users, orders, products copied

### Ongoing Options

| Strategy | Command | Use Case |
|----------|---------|----------|
| **Reset to prod** | Neon: Reset from parent | Fresh copy of prod data |
| **Keep staging data** | Do nothing | Accumulate test data |
| **Periodic refresh** | Reset weekly/monthly | Balance of both |

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
- [ ] Create Vercel staging project
- [ ] Configure staging environment variables
- [ ] Add `demo.craftculture.xyz` domain
- [ ] Configure DNS CNAME record
- [ ] Test authentication flow
- [ ] Test database operations
- [ ] Create test user accounts
- [ ] Document staging URLs for team

---

## Questions to Decide

1. **Domain:** `demo.craftculture.xyz` or `staging.craftculture.xyz`?
2. **Email:** Use same Loops key or create test account?
3. **Data refresh:** How often to reset staging from prod?
4. **Access:** Should staging require password protection?
5. **Trigger.dev:** Share jobs or separate project?

