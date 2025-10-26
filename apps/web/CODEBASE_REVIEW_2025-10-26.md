# Craft & Culture Codebase Review

**Location:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web`
**Review Date:** 2025-10-26
**Tech Stack:** Next.js 15, React 19, TypeScript, PostgreSQL (Neon), Drizzle ORM, tRPC, Trigger.dev, Better Auth

---

## Executive Summary

The Craft & Culture codebase demonstrates **strong architectural patterns** with excellent adherence to modern best practices. The application is well-structured with clear separation of concerns, type-safe APIs, and a comprehensive design system. The codebase totals **381 TypeScript files** (~2.7MB) with **7,265 lines of UI component code** and follows a feature-based organization pattern.

**Key Strengths:**
- Excellent TypeScript usage with strict mode enabled
- Well-organized feature-based architecture
- Comprehensive design system with 100+ reusable components
- Type-safe end-to-end APIs using tRPC
- Advanced search functionality with full-text and trigram indexing
- Sophisticated pricing model system using HyperFormula

**Key Areas for Improvement:**
- **Critical:** Zero test coverage (0 test files found)
- Missing Tailwind configuration file
- Limited error handling in some areas
- Performance optimization opportunities in quote calculation
- Warehouse sensor feature appears incomplete

---

## 1. Architecture & Structure

### Overall Organization ⭐⭐⭐⭐⭐

The codebase follows an **excellent feature-based architecture** with clear separation:

```
src/app/
├── _admin/          # Admin functionality (activity logs)
├── _auth/           # Authentication (Better Auth integration)
├── _cookies/        # Cookie consent management
├── _pricingModels/  # Sophisticated pricing engine
├── _products/       # Product catalog & search
├── _quotes/         # Quote generation (core feature)
├── _shared/         # Shared utilities & providers
├── _sheets/         # Google Sheets integration
├── _ui/             # Design system components
├── _warehouse/      # Warehouse sensor monitoring (NEW)
└── (routes)/        # Next.js App Router pages
```

**Strengths:**
- Clear feature boundaries with underscored prefix convention
- Consistent structure: `router.ts`, `controller/`, `components/`, `schemas/`, `utils/`
- One-function-per-file policy strictly followed
- Absolute imports using `@/` alias

**Files:** 381 TypeScript files organized across 7 feature modules

### Routing Structure ⭐⭐⭐⭐

Next.js 15 App Router implementation with:
- Route groups: `(auth)`, `(platform)` for layout organization
- Protected routes via middleware
- API routes for tRPC and Better Auth
- Redirect from `/` to `/platform/quotes` (main entry point)

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/middleware.ts` (37 lines)

```typescript
const protectedRoutes = [
  /(?:^|\/)([\w-]+\/)?platform/,
  /(?:^|\/)([\w-]+\/)?welcome/,
];
```

### tRPC Router Organization ⭐⭐⭐⭐⭐

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/trpc-router.ts`

```typescript
export const appRouter = createTRPCRouter({
  admin: adminRouter,           // Activity logging
  users: usersRouter,           // User management
  products: productsRouter,     // Product catalog
  quotes: quotesRouter,         // Quote generation
  pricingModels: pricingModelsRouter,  // Pricing engine
  sheets: sheetsRouter,         // Sheet management
  warehouse: warehouseRouter,   // Warehouse sensors (NEW)
});
```

**Strengths:**
- Clean namespace separation
- 7 domain-specific routers
- Type-safe with `AppRouter` export
- Each router in its own feature directory

---

## 2. Code Quality & Patterns

### TypeScript Usage ⭐⭐⭐⭐⭐

**Exceptional TypeScript discipline:**
- Strict mode enabled: `"strict": true`
- No unchecked indexed access: `"noUncheckedIndexedAccess": true`
- **Zero `any` types found** in grep search
- Proper type inference throughout
- Type-only imports used consistently

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2017"
  }
}
```

### Coding Standards Adherence ⭐⭐⭐⭐⭐

**Perfect alignment with CLAUDE.md standards:**

✅ One function per file
✅ Default exports only
✅ Arrow functions with const
✅ TSDoc comments on exported functions
✅ No multiline `//` comments for documentation
✅ camelCase for utilities, PascalCase for components
✅ Feature-based directories with `_` prefix

**Example from `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/utils/tryCatch.ts`:**

```typescript
/**
 * A higher order function that takes a function, executes it and returns its
 * value. If the function throws an error, it will be returned as the second
 * element of the tuple.
 *
 * @param fn - The function to execute
 * @returns A tuple of [value, error]
 */
const tryCatch = async <T, E extends Error = Error>(
  fn: (() => T | Promise<T>) | Promise<T>,
) => {
  // Implementation...
};

export default tryCatch;
```

### Component Patterns ⭐⭐⭐⭐⭐

**Button component** (`/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_ui/components/Button/Button.tsx`):

```typescript
export interface ButtonProps extends VariantProps<typeof buttonStyles> {
  asChild?: boolean;
  isToggled?: boolean;
}

const Button = ({
  colorRole,
  variant,
  size,
  asChild,
  shape,
  className,
  children,
  isDisabled,
  isToggled,
  ...props
}: React.PropsWithChildren<
  ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>) => {
  const ButtonWrapper = asChild ? Slot : 'button';
  return <ButtonWrapper {...props}>{children}</ButtonWrapper>;
};

export default Button;
```

**Strengths:**
- Proper interface exports
- Props destructuring in signature
- tailwind-variants for type-safe styling
- Slot pattern for polymorphic components

### Error Handling ⭐⭐⭐⭐

**Strengths:**
- Custom `tryCatch` utility for tuple-based error handling
- TRPCError used consistently in API procedures
- Type-safe error checks
- Context logging with error objects

**Example from `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/lib/trpc/procedures.ts`:**

```typescript
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});
```

**Weaknesses:**
- Missing error boundaries in some client components
- Some promises not properly awaited (caught by ESLint rule)
- Exchange rate fetch silently defaults to 1 on failure

### Import Organization ⭐⭐⭐⭐⭐

**ESLint enforces perfect import ordering:**

```typescript
// External libraries
import { IconDownload, IconSearch } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';

// Internal libraries
import quotesSearchParams from '@/app/_quotes/search-params/filtersSearchParams';
import Button from '@/app/_ui/components/Button/Button';

// Type imports
import type { Product } from '../controller/productsGetMany';
```

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/eslint.config.mjs` (lines 84-107)

---

## 3. State Management

### URL State Management (nuqs) ⭐⭐⭐⭐⭐

**Excellent use of type-safe URL state:**

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_quotes/search-params/filtersSearchParams.ts`

```typescript
const urlLineItemSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1),
  vintage: z.string().optional(),
});

const quotesSearchParams = {
  items: parseAsArrayOf(parseAsJson(urlLineItemSchema)).withDefault([]),
  countries: parseAsArrayOf(parseAsString).withDefault([]),
  regions: parseAsArrayOf(parseAsString).withDefault([]),
  producers: parseAsArrayOf(parseAsString).withDefault([]),
  vintages: parseAsArrayOf(parseAsInteger).withDefault([]),
};
```

**Strengths:**
- Type-safe URL search params with Zod validation
- Complex objects (line items) serialized as JSON in URL
- Default values prevent undefined states
- Server-side parsing in Next.js pages

### React Query / tRPC ⭐⭐⭐⭐⭐

**Outstanding caching strategy:**

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_products/components/CatalogBrowser.tsx`

```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
  useInfiniteQuery({
    ...api.products.getMany.infiniteQueryOptions({
      limit: 24,
      search: normalizedSearch,
      omitProductIds,
      countries: filters.countries,
      // ... more filters
    }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
    initialPageParam: 0,
    placeholderData: (previousData) => previousData, // ⭐ Keeps old data during refetch
  });
```

**Strengths:**
- Infinite scroll with cursor-based pagination
- Placeholder data prevents UI flash
- Server-side prefetching in page components
- Optimistic updates in mutations

**Example prefetching** (`/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/(routes)/(platform)/platform/quotes/page.tsx`):

```typescript
const QuotesPage = async ({ searchParams }) => {
  const queryClient = getQueryClient();

  if (productIds.length > 0) {
    void queryClient.prefetchQuery(
      api.products.getMany.queryOptions({ productIds })
    );
  }
  // Data ready before client renders
};
```

### Client State ⭐⭐⭐⭐

**Minimal local state, mostly URL-driven:**
- Search input debouncing (300ms delay)
- Loading states for async operations
- Form state with react-hook-form
- Cookie consent with Jotai atoms

**Weakness:** No global client state management (could be intentional)

---

## 4. Database & Backend

### Drizzle ORM Schema ⭐⭐⭐⭐⭐

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/database/schema.ts` (242 lines)

**Tables:**
- `users` - User accounts with role and customer type
- `sessions` - Better Auth sessions
- `accounts` - OAuth accounts
- `products` - Wine catalog with advanced search indexes
- `productOffers` - CultX inventory with pricing
- `pricingModels` - Configurable pricing formulas
- `sheets` - Google Sheets as formula data
- `adminActivityLogs` - Audit trail
- `warehouseSensorReadings` - IoT sensor data (NEW)

**Strengths:**
- RLS enabled on all tables (`.enableRLS()`)
- Proper foreign key relationships with cascade
- Advanced PostgreSQL features (GIN indexes, full-text search)
- Type inference with `$inferSelect`
- Timestamp helpers for created/updated tracking

**Advanced Search Indexes:**

```typescript
export const products = pgTable(
  'products',
  { /* columns */ },
  (table) => [
    // Full-text search with weighted fields
    index('products_search_idx').using('gin', sql`
      setweight(to_tsvector('english', coalesce(${table.name}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${table.producer}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${table.lwin18}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${table.region}, '')), 'B')
    `),
    // Trigram indexes for fuzzy matching
    index('products_name_trigram_idx').using('gin', sql`${table.name} gin_trgm_ops`),
    index('products_producer_trigram_idx').using('gin', sql`${table.producer} gin_trgm_ops`),
  ]
);
```

### Query Optimization ⭐⭐⭐⭐

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_products/controller/productsGetMany.ts` (283 lines)

**Sophisticated search algorithm:**
1. **Full-text search** with `websearch_to_tsquery`
2. **Trigram similarity** for fuzzy matching (threshold: 0.12-0.25)
3. **Token matching** for multi-word queries (60% threshold)
4. **Ranking score** combining multiple signals

```typescript
const score = sql<number>`
  (${tsRank} * ${tsRankWeight}) +              // 55-65%
  (${trigramSimilarity} * ${trigramWeight}) +   // 25-35%
  ${exactMatchBoost} +                          // Bonus for exact matches
  (${tokenMatchRatio} * ${tokenScoreWeight})    // 25-30%
`;
```

**Strengths:**
- Parallel queries with `Promise.all`
- Cursor-based pagination
- Sub-query for minimum price sorting
- Dynamic ordering based on search/sort parameters

**Weaknesses:**
- Potential N+1 on product offers (mitigated with `limit: 1`)
- Count query runs on every request (could be cached)

### tRPC Procedures ⭐⭐⭐⭐⭐

**Well-architected procedure types:**

```typescript
// Public - accessible to all
export const publicProcedure = t.procedure;

// Protected - requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});

// Admin - requires admin role
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ctx.accessControl(() => ctx.user.role === 'admin');
  return await next({ ctx });
});
```

**Context Creation** (`/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/lib/trpc/context.ts`):

```typescript
const createTRPCContext = async () => {
  const user = await getCurrentUser(); // Cached with React cache()

  const accessControl = (checkFn: () => boolean) => {
    if (!checkFn()) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      });
    }
  };

  return { user, accessControl };
};
```

---

## 5. Frontend & UI

### Design System ⭐⭐⭐⭐⭐

**Comprehensive component library** (100+ components):

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_ui/components/`

- **Layout:** Card, Divider, ContentWrapper
- **Forms:** Input, Select, Checkbox, Radio, Switch, Slider
- **Feedback:** Dialog, AlertDialog, Drawer, Toast (Sonner)
- **Navigation:** Dropdown, Command, Combobox
- **Data:** DataTable (TanStack Table), Calendar, Badge
- **Typography:** Custom Typography component with variants

**7,265 total lines** of UI component code

**tailwind-variants Usage:**

```typescript
export const buttonStyles = tv({
  base: 'focus:outline-hidden flex items-center transition-all duration-150',
  variants: {
    colorRole: {
      primary: 'bg-fill-primary text-text-primary hover:bg-fill-primary-hover',
      brand: 'bg-fill-brand text-text-brand-on-fill hover:bg-fill-brand-hover',
      danger: 'bg-fill-danger text-text-danger-on-fill hover:bg-fill-danger-hover',
    },
    size: {
      xs: 'h-7 px-1.5 text-xs',
      sm: 'h-8 px-2',
      md: 'h-9 px-2.5',
      lg: 'h-10 px-3',
      xl: 'h-11 px-4 text-md',
    },
  },
  defaultVariants: {
    colorRole: 'primary',
    size: 'md',
  },
});
```

### Tailwind CSS ⭐⭐⭐⭐

**Custom Design Tokens:**
- `fill-primary`, `fill-brand`, `fill-danger` - Background colors
- `text-primary`, `text-muted`, `text-brand-on-fill` - Text colors
- `border-primary`, `border-muted`, `border-brand` - Border colors

**Issue:** Tailwind config file not found (searched for `tailwind.config.*`)

**Recommendation:** HIGH PRIORITY - Create or restore Tailwind configuration

### Responsive Design ⭐⭐⭐⭐

**Mobile-first approach:**

```tsx
<div className="grid grid-cols-2 gap-3
                sm:grid-cols-3
                md:grid-cols-4 md:gap-4
                lg:grid-cols-5
                xl:grid-cols-6">
```

**Strengths:**
- Consistent breakpoint usage
- Landscape mode considerations (`landscape:py-2`)
- Touch-friendly sizing on mobile
- Responsive typography

### Accessibility ⭐⭐⭐

**Partial accessibility implementation:**

✅ Semantic HTML elements
✅ `aria-disabled` on buttons
✅ Radix UI primitives (built-in a11y)
✅ Focus states with ring utilities
⚠️ Missing ARIA labels in some places
⚠️ No skip-to-content link
⚠️ Color contrast not audited

---

## 6. Dependencies & Integrations

### Key Dependencies (package.json)

**Framework:**
- `next@^15.5.4` - Latest Next.js
- `react@^19.1.0` - React 19 (latest)
- `typescript@^5` - TypeScript 5

**Backend:**
- `@trpc/server@^11.1.4` - Type-safe APIs
- `drizzle-orm@1.0.0-beta.1` - ORM (beta version)
- `better-auth@^1.3.26` - Authentication
- `@trigger.dev/sdk@^4.0.4` - Background jobs

**UI:**
- `@radix-ui/react-*` - 15+ Radix primitives
- `tailwind-merge@^3.3.1` - Class merging
- `tailwind-variants@^1.0.0` - Type-safe variants
- `motion@^12.23.3` - Animations

**State:**
- `@tanstack/react-query@^5.79.0` - Server state
- `nuqs@^2.4.3` - URL state
- `jotai@^2.12.5` - Atom-based state

**Data Processing:**
- `hyperformula@^3.0.1` - Excel-like calculations
- `zod@^4.1.12` - Schema validation
- `date-fns@^4.1.0` - Date utilities

### External Integrations

**1. CultX API** - Wine product inventory
- OpenAPI schema: `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/lib/cultx/schema.d.ts`
- Sync job: Every 30 minutes (cron: `0,30 * * * *`)
- Data: ~10,000 products synced in batches of 100

**2. Trigger.dev** - Background job processing
- Config: `/Users/kevinbradford/Projects/Craft-Culture/apps/web/trigger.config.ts`
- Jobs: Product sync from CultX
- Sentry middleware for error tracking

**3. Better Auth** - Magic link authentication
- No auth.ts file found (likely in better-auth server client)
- Cookie-based sessions
- Support for passkeys, OAuth accounts

**4. Sentry** - Error tracking
- Client & server configs
- Source map upload in production
- Tunnel route: `/monitoring`

**5. Warehouse Sensors (NEW)** ⚠️
- REST API endpoint: `/api/warehouse/sensors`
- Real-time sensor readings stored in PostgreSQL
- Component: `WarehouseDataFeed` in footer

### Outdated Dependencies ⭐⭐⭐⭐⭐

**Result:** `{}` (no outdated packages)

All dependencies are up-to-date. Excellent maintenance.

---

## 7. Performance

### Bundle & Build ⭐⭐⭐⭐

**Next.js Configuration:**
- Turbo mode enabled (`next dev --turbo`)
- React Compiler experimental (auto-memoization)
- MDX support for documentation pages
- Source map upload to Sentry (production only)

**Optimizations:**
- Image optimization with remote patterns
- Route-based code splitting (App Router)
- Lazy loading with `next/dynamic`
- Prefetching with React Query

**Concerns:**
- HyperFormula library is large (~500KB)
- Extensive console logging in production (`calculateQuote.ts` has 40+ console.log statements)

### Database Performance ⭐⭐⭐⭐

**Strengths:**
- GIN indexes for full-text and trigram search
- Partial indexes on boolean flags
- Cursor-based pagination
- Connection pooling via Neon

**Weaknesses:**
- Count query on every product fetch
- No query result caching layer
- Potential slow queries with complex search

### Client Performance ⭐⭐⭐⭐

**Infinite Scroll Implementation:**

```typescript
const handleScroll = useCallback(() => {
  if (!gridRef.current || !hasNextPage || isFetchingNextPage) return;

  const { scrollTop, scrollHeight, clientHeight } = gridRef.current;
  if (scrollHeight - scrollTop <= clientHeight * 1.5) {
    void fetchNextPage(); // Trigger at 1.5x viewport from bottom
  }
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);
```

**Strengths:**
- 300ms search debouncing
- Placeholder data prevents flash
- Skeleton loading states
- Memoized product list

### Quote Calculation Performance ⚠️

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_pricingModels/utils/calculateQuote.ts` (422 lines)

**Issues:**
1. **40+ console.log statements** in production code
2. Synchronous HyperFormula sheet building
3. No calculation result caching
4. Exchange rate fetched on every request (cached for 1 day externally)

**Recommendation:** MEDIUM PRIORITY
- Remove/disable production logging
- Cache calculation results per line item combination
- Pre-warm HyperFormula instance

---

## 8. Security

### Authentication ⭐⭐⭐⭐⭐

**Better Auth Integration:**
- Magic link authentication
- Session cookie validation
- Protected route middleware
- Role-based access control (user/admin)

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/middleware.ts`

```typescript
const hasSession =
  getSessionCookie(request, { cookiePrefix: clientConfig.cookiePrefix }) !== null ||
  request.headers.get('Authorization') !== null;

if (protectedRoutes.some((route) => route.test(pathname)) && !hasSession) {
  return NextResponse.redirect(new URL(`/sign-in?next=${pathname}`, request.url));
}
```

### Data Validation ⭐⭐⭐⭐⭐

**Zod schemas everywhere:**
- All tRPC inputs validated
- Type inference from schemas
- User-friendly error messages with `zod-validation-error`

**Example:**

```typescript
const urlLineItemSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1),
  vintage: z.string().optional(),
});
```

### Environment Variables ⭐⭐⭐⭐

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/.env.example` (70 lines)

**Required variables documented:**
- `DB_URL` - PostgreSQL connection
- `BETTER_AUTH_SECRET` - Auth secret
- `ENCRYPTION_KEY` - For OAuth tokens
- `LOOPS_API_KEY` - Transactional emails
- `NEXT_PUBLIC_APP_URL` - App URL
- Optional: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`

**Strengths:**
- Clear comments with generation instructions
- Sensible defaults
- Public vars prefixed with `NEXT_PUBLIC_`

### Potential Vulnerabilities ⚠️

1. **RLS enabled but policies not visible** - Need to verify Neon policies
2. **Admin activity logging** - Good audit trail
3. **No rate limiting** visible on API routes
4. **SQL injection protected** by Drizzle ORM parameterization
5. **XSS protection** via React's built-in escaping

**Recommendation:** MEDIUM PRIORITY
- Add rate limiting middleware
- Implement CSRF protection for mutations
- Verify RLS policies in Neon dashboard

---

## 9. Testing & Documentation

### Test Coverage ⚠️ **CRITICAL**

**Result:** **0 test files found**

```bash
find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l
# Output: 0
```

**Vitest configured** but no tests written:
- `vitest.config.mts` exists
- `"test": "vitest"` script in package.json

**Recommendation:** **HIGH PRIORITY**
- Unit tests for utility functions (`tryCatch`, `calculateQuote`)
- Integration tests for tRPC procedures
- E2E tests for quote generation flow
- Component tests for UI library

### TSDoc Comments ⭐⭐⭐⭐

**Good documentation in utility functions:**

```typescript
/**
 * Calculate markup percentage for wine pricing
 *
 * @example
 *   calculateMarkup(100, 150); // returns 50
 *
 * @param cost - The cost price
 * @param sellingPrice - The selling price
 * @returns The markup percentage
 */
```

**Strengths:**
- Consistent TSDoc format
- Examples included
- Param descriptions
- Return type documentation

**Weaknesses:**
- Not all exported functions documented
- Complex algorithms (search) lack explanation
- No architectural decision records (ADRs)

### README Documentation ⭐⭐⭐

**File:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/README.md` (43 lines)

**Contents:**
- Tech stack overview
- Getting started instructions
- Prerequisites listed
- Installation steps

**Missing:**
- Development workflow
- Deployment guide
- Architecture diagrams
- API documentation
- Contributing guidelines

### Code Comments ⭐⭐⭐⭐

**Inline comments used appropriately:**
- Complex logic explained
- TODOs marked (1 found: pricing model validation)
- No unnecessary comments

**Single TODO found:**
```typescript
// TODO: Validate cell mappings against a random product from the sheet
```

**Location:** `/Users/kevinbradford/Projects/Craft-Culture/apps/web/src/app/_pricingModels/controller/pricingModelsCreate.ts:45`

---

## 10. Technical Debt & Issues

### Current Technical Debt

#### HIGH PRIORITY

1. **Zero Test Coverage** ⚠️
   - **Impact:** High risk of regressions
   - **Effort:** Large (weeks to reach 70%+ coverage)
   - **Action:** Start with critical paths (quote calculation, product search)

2. **Missing Tailwind Config** ⚠️
   - **Impact:** Can't customize design tokens
   - **Effort:** Small (1-2 hours)
   - **Action:** Create `tailwind.config.ts` with custom theme

3. **Excessive Production Logging** ⚠️
   - **Impact:** Performance degradation, log costs
   - **File:** `calculateQuote.ts` (40+ console.log)
   - **Effort:** Small (1-2 hours)
   - **Action:** Replace with conditional logging or remove

#### MEDIUM PRIORITY

4. **Warehouse Feature Incomplete** ⚠️
   - **Evidence:**
     - `WAREHOUSE_SETUP_SIMPLE.md` in root
     - `WAREHOUSE_SENSORS.md` documentation
     - Schema exists but integration unclear
   - **Impact:** Unclear feature status
   - **Action:** Complete or remove if deprecated

5. **Quote Calculation Performance**
   - **Issue:** No caching, synchronous processing
   - **Impact:** Slow quote generation with complex models
   - **Action:** Implement result caching, async processing

6. **Product Count Query Optimization**
   - **Issue:** Runs on every product fetch
   - **Impact:** Unnecessary database load
   - **Action:** Cache total count, invalidate on sync

7. **Rate Limiting Missing**
   - **Impact:** Potential abuse of API endpoints
   - **Action:** Add middleware for tRPC and REST APIs

#### LOW PRIORITY

8. **Better Auth Configuration Not Visible**
   - **Issue:** No `auth.ts` file found
   - **Action:** Document auth setup or expose config

9. **Accessibility Improvements**
   - **Missing:** Skip links, ARIA labels, contrast audit
   - **Action:** Run Lighthouse audit, fix issues

10. **Bundle Size Optimization**
    - **HyperFormula:** Large dependency (~500KB)
    - **Action:** Evaluate if smaller alternative exists

### Known Issues

1. **Filter Closing Bug** - Recently fixed (per git status)
   - Commit: "fix: prevent page scroll when selecting filters"
   - Status: ✅ Resolved

2. **Exchange Rate Fallback**
   - Issue: Silently defaults to 1 on API failure
   - Location: `quotesGet.ts:58`
   - Impact: Incorrect pricing if rates unavailable
   - Recommendation: Log error, notify user

### Code Duplication

**Minimal duplication detected:**
- Cell reference parsing logic could be extracted (appears in `calculateQuote.ts`)
- Search expression building could be reusable
- Overall: ⭐⭐⭐⭐ (minimal duplication)

---

## Detailed Findings by Area

### Database Schema Analysis

**Table Relationships:**

```
users ──┬── sessions (1:many)
        ├── accounts (1:many)
        ├── passkeys (1:many)
        ├── adminActivityLogs (1:many)
        └── pricingModelId (many:1) → pricingModels

pricingModels ──┬── users (1:many)
                └── sheetId (many:1) → sheets

products ──┬── productOffers (1:many)
           └── Full-text search indexes

warehouseSensorReadings (standalone)
```

**Index Strategy:**
- Full-text search on `products` (name, producer, lwin18, region)
- Trigram indexes for fuzzy matching
- B-tree indexes on foreign keys
- Partial indexes on boolean flags (defaults)
- Time-series index on `warehouseSensorReadings.timestamp`

### Architecture Patterns

**Separation of Concerns:**

```
Feature Module Structure:
├── router.ts              # tRPC router definition
├── controller/            # Business logic (procedures)
├── data/                  # Database queries
├── components/            # React components
├── schemas/               # Zod validation schemas
├── utils/                 # Feature-specific utilities
└── search-params/         # URL state parsing
```

**Example: Quotes Feature**
- `router.ts` (10 lines) - Single route definition
- `controller/quotesGet.ts` (85 lines) - Quote generation logic
- `components/QuotesForm.tsx` - UI implementation
- `schemas/getQuoteRequestSchema.ts` - Input validation
- `utils/exportQuoteToExcel.ts` - Export functionality

### Performance Metrics (Estimated)

**Database:**
- Product search: <100ms (with indexes)
- Quote calculation: 200-500ms (HyperFormula)
- Product sync: 2-5 minutes (10,000 products)

**Frontend:**
- Initial page load: ~2s (Next.js with SSR)
- Product infinite scroll: ~100ms per page
- Search debounce: 300ms delay

**Bundle Size:** (Not measured, but concerns:)
- HyperFormula: ~500KB
- Radix UI: ~200KB combined
- React 19: ~130KB

---

## Prioritized Recommendations

### Immediate Actions (This Sprint)

1. **Add Test Infrastructure** 🔴
   - Priority: CRITICAL
   - Effort: 2-3 days
   - Actions:
     - Write tests for `tryCatch` utility
     - Test `calculateQuote` with sample data
     - Test product search ranking
     - Set up CI test pipeline

2. **Remove Production Logging** 🔴
   - Priority: HIGH
   - Effort: 1-2 hours
   - File: `calculateQuote.ts`
   - Actions:
     - Wrap logs in `if (process.env.NODE_ENV === 'development')`
     - Or remove entirely
     - Replace with Sentry breadcrumbs for errors

3. **Create Tailwind Config** 🔴
   - Priority: HIGH
   - Effort: 1-2 hours
   - Actions:
     - Generate from existing tokens
     - Document custom theme
     - Add to version control

### Short-term (Next 2 Weeks)

4. **Optimize Quote Calculation**
   - Priority: MEDIUM
   - Actions:
     - Cache HyperFormula instances
     - Implement result caching (Redis or in-memory)
     - Profile calculation performance

5. **Add Rate Limiting**
   - Priority: MEDIUM
   - Actions:
     - Install `@upstash/ratelimit`
     - Add middleware for tRPC
     - Configure limits per endpoint

6. **Warehouse Feature Decision**
   - Priority: MEDIUM
   - Actions:
     - Review with product owner
     - Complete integration or remove
     - Update documentation

7. **Error Handling Improvements**
   - Priority: MEDIUM
   - Actions:
     - Add error boundaries
     - Improve exchange rate fallback
     - Add user-facing error messages

### Medium-term (Next Month)

8. **Accessibility Audit**
   - Priority: MEDIUM
   - Actions:
     - Run Lighthouse accessibility scan
     - Add skip-to-content link
     - Audit color contrast
     - Add missing ARIA labels

9. **Performance Monitoring**
   - Priority: MEDIUM
   - Actions:
     - Set up Core Web Vitals tracking
     - Add performance marks for critical flows
     - Monitor quote calculation times

10. **Documentation Expansion**
    - Priority: LOW
    - Actions:
      - Architecture diagrams
      - API documentation with examples
      - Deployment runbook
      - Contributing guidelines

---

## Code Examples of Best Practices

### 1. Type-Safe Search Params (Excellent)

```typescript
// URL state with validation
const quotesSearchParams = {
  items: parseAsArrayOf(parseAsJson(urlLineItemSchema)).withDefault([]),
  countries: parseAsArrayOf(parseAsString).withDefault([]),
};

// Usage in component
const [filters] = useQueryStates(quotesSearchParams);
```

### 2. Error Handling Pattern (Good)

```typescript
const [user, userError] = await tryCatch(getCurrentUser());

if (userError) {
  console.error('Error getting current user', { userError });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to get user',
  });
}
```

### 3. Database Transaction (Excellent)

```typescript
await db.transaction(async (tx) => {
  // Unset current default
  if (isDefaultB2C) {
    await tx.update(pricingModels)
      .set({ isDefaultB2C: false })
      .where(eq(pricingModels.isDefaultB2C, true));
  }

  // Create new default
  await tx.insert(pricingModels).values({ /* ... */ });
});
```

### 4. Infinite Scroll (Excellent)

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  ...api.products.getMany.infiniteQueryOptions({ limit: 24 }),
  getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
  placeholderData: (previousData) => previousData, // Prevents flash
});

const products = useMemo(
  () => data?.pages.flatMap((page) => page.data) ?? [],
  [data?.pages]
);
```

---

## Summary of Ratings

| Area | Rating | Notes |
|------|--------|-------|
| Architecture | ⭐⭐⭐⭐⭐ | Feature-based, clean separation |
| TypeScript | ⭐⭐⭐⭐⭐ | Strict mode, zero `any` types |
| Code Quality | ⭐⭐⭐⭐⭐ | Adheres perfectly to standards |
| State Management | ⭐⭐⭐⭐⭐ | URL state + React Query |
| Database | ⭐⭐⭐⭐⭐ | Advanced indexing, RLS |
| UI/Design System | ⭐⭐⭐⭐⭐ | 100+ components, tailwind-variants |
| Performance | ⭐⭐⭐⭐ | Good, but quote calc needs work |
| Security | ⭐⭐⭐⭐ | Good auth, needs rate limiting |
| Testing | ⭐ | **CRITICAL: Zero test coverage** |
| Documentation | ⭐⭐⭐ | TSDoc good, README basic |

**Overall Grade: A-** (would be A+ with test coverage)

---

## Action Items Summary

### Critical (Do Now)
- [ ] Add test infrastructure and write first tests
- [ ] Remove/conditionally disable production logging
- [ ] Create Tailwind configuration file

### High Priority (This Week)
- [ ] Optimize quote calculation performance
- [ ] Add rate limiting middleware
- [ ] Resolve warehouse feature status
- [ ] Improve error handling and user feedback

### Medium Priority (This Month)
- [ ] Run accessibility audit and fix issues
- [ ] Set up performance monitoring
- [ ] Cache product count queries
- [ ] Document architecture and deployment

### Low Priority (Backlog)
- [ ] Evaluate HyperFormula alternatives
- [ ] Add E2E tests
- [ ] Create contributing guidelines
- [ ] Bundle size optimization

---

## Conclusion

The Craft & Culture codebase is **exceptionally well-architected** with strong TypeScript discipline, excellent separation of concerns, and modern best practices. The feature-based organization makes the codebase easy to navigate, and the use of tRPC ensures type safety across the stack.

**Major Strengths:**
- Clean architecture with clear patterns
- Sophisticated product search with advanced PostgreSQL features
- Innovative pricing model system using spreadsheet formulas
- Comprehensive design system
- Zero technical debt from legacy code

**Critical Gap:**
The **complete absence of tests** is the only major concern. For a production B2B/B2C application handling quotes and pricing, test coverage is essential for:
- Regression prevention
- Refactoring confidence
- Documentation of behavior
- Onboarding new developers

**Recommendation:** Prioritize test coverage immediately. Start with critical business logic (`calculateQuote`, product search) before expanding UI coverage.

With test coverage added, this codebase would be a **best-in-class** example of modern Next.js application architecture.
