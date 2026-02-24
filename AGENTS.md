# AI Agent Instructions for Craft & Culture

This document provides instructions for AI agents (LLMs) working on the Craft & Culture codebase. When you receive a contribution request, follow the guidelines, coding standards, and deployment workflow outlined below.

## Project Context

Craft & Culture is a B2B/B2C web application helping wine and spirits brands succeed in GCC markets. The platform features:

- **Product management** - Wine product catalog and inventory management
- **Quote generation** - Creating quotes with multiple line items
- **Custom pricing models** - Spreadsheet-like pricing formulas
- **User management** - Magic link authentication with B2B/B2C customer types
- **Warehouse Management System (WMS)** - Full inventory, receiving, putaway, picking, and dispatch
- **Zoho Integration** - Sales orders sync, invoicing, and accounting automation

**Tech Stack:** Next.js 15, React 19, TypeScript, PostgreSQL (Neon), Drizzle ORM, Better Auth, tRPC, Trigger.dev, Tailwind CSS 4

**Live URLs:**
- Production: https://wine.craftculture.xyz
- Warehouse: https://warehouse.craftculture.xyz

The user you're assisting has deep domain expertise in wine trading, regional markets, compliance, and distribution. They may request changes to business logic, pricing models, product workflows, or UI improvements. Your role is to implement their requests while maintaining code quality and following the established patterns.

---

## WMS (Warehouse Management System)

The WMS module (`apps/web/src/app/_wms/`) handles physical warehouse operations for wine storage and fulfillment.

### Hardware

- **Scanner:** Zebra TC27 (Android-based barcode scanner with Chrome browser)
- **Printer:** Zebra ZD421 (thermal label printer for 4x6" labels, Bluetooth connected)
- **Barcode Format:** Code 128 for locations, QR codes for case labels

### Zebra Printing Setup

The ZebraPrint component (`apps/web/src/app/_wms/components/ZebraPrint.tsx`) handles label printing across different environments:

**Environments:**

| Environment | Method | How It Works |
|-------------|--------|--------------|
| Desktop (Mac/PC) | Zebra Browser Print | Install Browser Print app, auto-detects paired printer |
| Mobile (TC27) | Web Share API | Share ZPL file → Select "Printer Setup Utility" → Prints |
| Enterprise Browser | Native Zebra API | Direct Bluetooth printing (paid license required) |

**Mobile Printing Workflow (TC27 → ZD421):**

1. TC27 must be Bluetooth paired with ZD421 (one-time setup via Android Settings)
2. Install "Zebra Printer Setup Utility" app on TC27 from Play Store
3. In WMS, tap Print button → Share sheet appears
4. Select "Printer Setup Utility" → Label prints immediately

**Why Not Web Bluetooth?**
Web Bluetooth only supports Bluetooth Low Energy (BLE). The ZD421 connects via Bluetooth Classic (SPP) for printing, which browsers cannot access. The share-to-app workflow is the practical solution for mobile.

**ZPL (Zebra Programming Language):**
Labels are generated as ZPL code. Example:
```zpl
^XA
^FO50,30^ADN,46,24^FDLOC-A-01-02^FS
^FO50,100^BY2^BCN,80,Y,N,N^FDLOC-A-01-02^FS
^XZ
```

**Key Files:**
- `ZebraPrint.tsx` - Print component and `useZebraPrint()` hook
- `generateLocationLabelZpl.ts` - Generate location label ZPL
- `generateCaseLabelZpl.ts` - Generate case label ZPL

### Key WMS Tables

```
wmsLocations        - Warehouse locations (rack, floor, receiving, shipping)
wmsStock            - Current inventory by LWIN18/location/owner
wmsCaseLabels       - Individual case tracking with barcodes
wmsStockMovements   - Audit trail of all stock movements
wmsPickLists        - Order picking batches
wmsPickListItems    - Individual items to pick
wmsPallets          - Pallet tracking
```

### WMS Workflows

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/platform/admin/wms` | Overview and navigation |
| Receiving | `/platform/admin/wms/receiving` | Receive shipments → Creates stock + case labels |
| Putaway | `/platform/admin/wms/putaway` | Scan case → Scan destination → Move to storage |
| Transfer | `/platform/admin/wms/transfer` | Scan source → Select stock → Scan destination |
| Pick | `/platform/admin/wms/pick` | Pick items for orders |
| Dispatch | `/platform/admin/wms/dispatch` | Create dispatch batches, add orders, ship to distributors |
| Labels | `/platform/admin/wms/labels` | Print location and case labels |
| Movements | `/platform/admin/wms/movements` | View movement history |
| Scanner Test | `/platform/admin/wms/scanner-test` | Test barcode scanner |

### Dispatch Workflow

The dispatch module handles outbound shipments to distributors. Orders flow through these stages:

| Status | Description | What Happens |
|--------|-------------|--------------|
| **Draft** | Batch created, adding orders | Group orders going to same distributor on same truck |
| **Picking** | Warehouse picking stock | Workers pulling cases from shelves for this batch |
| **Staged** | Ready at loading dock | Pallets wrapped and waiting for truck |
| **Dispatched** | Truck has left | Driver en route to distributor |
| **Delivered** | Confirmed arrival | Distributor received the goods |

**Key Tables:**
```
wmsDispatchBatches      - Batch header (distributor, status, totals)
wmsDispatchBatchOrders  - Join table linking orders to batches
wmsDeliveryNotes        - Delivery paperwork for batches
```

**Order Sources:**
- Zoho Sales Orders (`zohoSalesOrders`) - Synced from Zoho, linked via `dispatchBatchId`
- Private Client Orders (`privateClientOrders`) - Internal orders, linked via `dispatchBatchId`

**API Endpoints:**
```typescript
wms.admin.dispatch.create          // Create new batch
wms.admin.dispatch.getMany         // List batches with filters
wms.admin.dispatch.getOne          // Get batch with orders
wms.admin.dispatch.addZohoOrders   // Add Zoho orders to batch
wms.admin.dispatch.addOrders       // Add PCO orders to batch
wms.admin.dispatch.updateStatus    // Change batch status
```

**Flow:**
1. Create dispatch batch for a distributor
2. Add picked orders (Zoho or PCO) to the batch
3. Update status: Draft → Picking → Staged → Dispatched → Delivered
4. Generate delivery notes (optional)

### Barcode Formats

- **Location:** `LOC-{aisle}-{bay}-{level}` (e.g., `LOC-A-01-02`)
- **Case Label:** `CASE-{lwin18}-{sequence}` (e.g., `CASE-1010279-2015-06-00750-001`)

### WMS Local Server (NUC)

Scanner-critical WMS operations route through a local NUC server for low-latency responses (~15ms vs ~200ms cloud). The system uses a **local-first routing** pattern — same UI, automatic fallback to cloud tRPC when the NUC is unreachable.

**Hardware:** Intel NUC 11, Ubuntu Server 24.04, Bun 1.3.9 + Hono + bun:sqlite
**IP:** `192.168.1.39:3000`
**SSH:** `ssh -i ~/.ssh/github_ed25519 kevin@192.168.1.39`
**Service:** `wms-server.service` (systemd, auto-starts on boot)

**Architecture:**
```
TC27 Scanner → warehouse.craftculture.xyz (Vercel)
                    ↓
             useWmsApi() hook
              ↙         ↘
    NUC (local)     Cloud tRPC (fallback)
    ~15ms           ~200ms
         ↓
    bun:sqlite → sync_queue → push to Neon every 30s
```

**Sync Engine:** Pulls 6 tables from Neon cloud every 30s (products, locations, stock, case labels, pick lists, pick list items). Write operations (transfer, putaway, pick) execute locally in SQLite AND queue to `sync_queue` for push to cloud.

**Local REST Endpoints (v2.0.0):**

| Endpoint | Method | Mirrors tRPC Procedure |
|----------|--------|------------------------|
| `/api/wms/scan-location` | POST | `wms.admin.operations.getLocationByBarcode` |
| `/api/wms/scan-case` | POST | `wms.admin.operations.getCaseByBarcode` |
| `/api/wms/transfer` | POST | `wms.admin.operations.transfer` |
| `/api/wms/putaway` | POST | `wms.admin.operations.putaway` |
| `/api/wms/pick-lists` | GET | `wms.admin.picking.getMany` |
| `/api/wms/pick-list/:id` | GET | `wms.admin.picking.getOne` |
| `/api/wms/pick-item` | POST | `wms.admin.picking.pickItem` |
| `/api/wms/pick-complete` | POST | `wms.admin.picking.complete` |

**Key Frontend Files:**
```
apps/web/src/app/_wms/
├── providers/LocalServerProvider.tsx  # Health check context (30s ping, 2s timeout)
├── hooks/useWmsApi.ts                # Local-first routing hook
└── components/ConnectionStatus.tsx   # Green "Local" / amber "Offline" indicator
```

**Pages using local-first routing:** Transfer, Pick detail, Repack
**Pages still cloud-only:** Receiving, Dispatch, Labels, Stock Explorer (not latency-sensitive)

**NUC Server Files (on NUC at `/home/kevin/wms-local-server/`):**
```
src/
├── index.ts       # Hono app entry, routes
├── api/wms.ts     # 8 REST endpoints matching tRPC response shapes
├── db/client.ts   # bun:sqlite connection
├── db/schema.sql  # SQLite table definitions
└── sync/          # pull.ts, push.ts, engine.ts
```

**Environment:** `NEXT_PUBLIC_WMS_LOCAL_SERVER_URL=http://192.168.1.39:3000` (set on Vercel production)

**TC27 Chrome Setup:** `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add `http://192.168.1.39:3000` → relaunch (allows HTTPS page to call HTTP local server)

### tRPC Pattern for WMS Pages

WMS scanner pages use the `useWmsApi()` hook for local-first routing. For pages that don't need local routing, use the standard tRPC pattern.

**Local-first pattern (scanner-critical pages):**

```typescript
import useWmsApi from '@/app/_wms/hooks/useWmsApi';
import useTRPC from '@/lib/trpc/browser';

const WMSPage = () => {
  const api = useTRPC();           // For cloud-only operations
  const wmsApi = useWmsApi();      // For local-first operations

  const handleScan = async (barcode: string) => {
    // Routes through NUC when available, falls back to cloud
    const result = await wmsApi.scanLocation(barcode);
  };

  // Local-first mutation
  const transfer = useMutation(wmsApi.transferMutationOptions());

  // Cloud-only mutation (not on NUC)
  const printLabel = useMutation({
    ...api.wms.admin.labels.printStockLabel.mutationOptions(),
  });
};
```

**Standard tRPC pattern (non-scanner pages):**

```typescript
import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

const WMSPage = () => {
  const api = useTRPC();           // For queryOptions/mutationOptions
  const trpcClient = useTRPCClient(); // For imperative .query() calls

  const handleScan = async (barcode: string) => {
    const result = await trpcClient.wms.admin.operations.getLocationByBarcode.query({ barcode });
  };

  const mutation = useMutation({
    ...api.wms.admin.operations.transfer.mutationOptions(),
  });
};
```

---

## Zoho Integration

The platform integrates with Zoho Books for accounting and Zoho Inventory for sales orders.

### Implemented Features

- **Sales Order Sync** - Scheduled job syncs open/invoiced orders from Zoho every 2 minutes
- **Manual Sync** - "Sync from Zoho" button for immediate sync
- **Order Approval** - Admin approves synced orders for warehouse release
- **Pick List Creation** - Create WMS pick lists from approved Zoho orders

### Key Files

```
apps/web/src/lib/zoho/
├── client.ts          # OAuth2 client with token refresh
├── types.ts           # Zoho API types
├── contacts.ts        # Contact sync
├── invoices.ts        # Invoice creation
├── bills.ts           # Bill creation for settlements
└── salesOrders.ts     # Sales order fetching

apps/web/src/trigger/jobs/zoho-sync/
├── zohoSalesOrderSyncJob.ts   # Scheduled sync every 2 mins
├── zohoPaymentSyncJob.ts      # Payment status sync
├── zohoCreateInvoiceJob.ts    # Create invoice on order confirm
└── zohoCreateBillJob.ts       # Create bill for settlement
```

### Database Tables

```
zohoSalesOrders      - Synced sales orders from Zoho
zohoSalesOrderItems  - Line items for each order
```

### Admin Pages

- `/platform/admin/zoho-sales-orders` - View and approve synced orders

---

## Current Development State

### Recently Completed
- WMS Local Server (NUC) — local-first routing for scanner operations (~15ms vs ~200ms)
- `useWmsApi()` hook with automatic NUC/cloud fallback on Transfer, Pick, Repack pages
- NUC sync engine — pulls from Neon every 30s, pushes local writes back
- WMS scanner integration with Zebra TC27
- Transfer, putaway, and repack page fixes (trpcClient pattern)
- Zoho Sales Order sync with approval workflow
- Mobile sidebar scroll fix for TC27
- ZD421 printer setup and EU RED security configuration
- Zebra printing via Web Share API (TC27 → Printer Setup Utility → ZD421)
- Stock import from Zoho Inventory export
- Dispatch batch workflow with Zoho order support
- Delivery note PDF generation

### In Progress
- Full end-to-end WMS testing with local-first routing
- Optimizing mobile printing workflow for high-volume label printing

### Pending
- Add Receiving and Dispatch endpoints to NUC local server
- Investigate faster mobile printing options (Enterprise Browser license vs current share workflow)
- Print case labels during receiving
- Dispatch confirmation workflow

---

## Future Development Concepts

### WMS Operator Profile (Planned)

A dedicated user role for warehouse operators using the TC27 scanner. This would provide a decluttered interface optimized for warehouse operations.

**Rationale:** Current WMS users have full admin access, seeing menu items irrelevant to warehouse operations (Finance, Partners, Users, etc.). A dedicated operator profile would:

1. **Streamlined Navigation** - Show only WMS-related menu items:
   - Dashboard (WMS-specific)
   - Receiving
   - Put Away
   - Transfer
   - Pick Lists
   - Dispatch
   - Labels
   - Movements

2. **Hidden Menu Items** - Remove from operator view:
   - Finance / Settlements
   - Partners
   - Users
   - Products (full management)
   - Quotes
   - Orders (admin view)
   - System Settings

3. **Implementation Approach:**
   - Add `role: 'wms_operator'` to user schema
   - Create `WMSOperatorLayout` component
   - Filter sidebar navigation based on role
   - Restrict tRPC procedures to appropriate roles
   - Keep `adminProcedure` for full admin access
   - Add `operatorProcedure` for WMS-only access

4. **TC27-Specific Optimizations:**
   - Larger touch targets (minimum 48px)
   - High-contrast color scheme
   - Simplified forms with minimal input fields
   - Auto-focus on scan inputs
   - Haptic feedback on scan success/error

**Status:** Concept documented for future implementation. Not started.

---

## Available MCP Integrations

This repository has the following MCP servers configured in `.mcp.json`:

### BrowserMCP

Web browser automation and interaction capabilities for testing web interfaces and data scraping.

### Neon

Direct integration with the Neon PostgreSQL database for:

- Database queries and operations
- Schema inspection and analysis
- Data management
- Migration operations

### Vercel

Deployment platform integration for:

- Checking deployment status and progress
- Monitoring build completion
- Managing environment variables
- Viewing deployment logs

**Important:** After pushing code to main, use the Vercel MCP to monitor the deployment and confirm success before reporting completion to the user.

---

## Coding Standards

Follow these standards strictly when writing or modifying code. These patterns are enforced throughout the codebase.

### Function Definitions

- **One function per file** - Each file exports a single main function or component
- **Default exports only** - Always use `export default`, never `export const` for the main export
- **Arrow functions with const** - For utility functions: `const functionName = () => {}`
- **Function declarations with const** - For React components: `const ComponentName = () => {}`
- **Infer return types** - Never explicitly type return types; let TypeScript infer them

Example:

```typescript
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

export default formatPrice;
```

### TypeScript Standards

- **No `any` types** - Use proper TypeScript types for all variables and parameters
- **Strict mode enabled** - All strict checks are enforced (`noUncheckedIndexedAccess`, `strict: true`)
- **Type-only imports** - Use `import type` for type imports: `import type { User } from './types'`
- **Interfaces for props** - Use interfaces (not type aliases) for component props and object shapes
- **Zod schema inference** - Use `z.infer<typeof schema>` for deriving types from schemas

### Documentation Standards

- **TSDoc syntax required** - Use `/** */` comments for all exported functions
- **No multiline `//` comments** - Never use `//` for multiline documentation
- **Include tags** - Add `@param`, `@returns`, and `@example` tags where appropriate
- **Inline comments** - Single-line `//` comments are acceptable for inline explanations

Example:

```typescript
/**
 * Generate a URL-friendly slug from a string
 *
 * @example
 *   slugify('Hello World'); // returns 'hello-world'
 *
 * @param text - The string to convert to a slug
 * @returns The slugified string
 */
const slugify = (text: string) => {
  return text.toLowerCase().replace(/\s+/g, '-');
};
```

### File Organization

- **camelCase** for utility files: `formatPrice.ts`, `getUserOrRedirect.ts`
- **PascalCase** for component files: `Button.tsx`, `Card.tsx`
- **Feature-based directories** with underscored prefixes: `_auth/`, `_ui/`, `_quotes/`
- **No index files** - Import directly from source files; avoid barrel exports
- **Absolute imports** - Use `@/` path alias: `@/lib/utils` not `../../../lib/utils`

### React/Component Patterns

- **Function declarations** for components: `const Button = () => {}`
- **Props destructuring** in function signature
- **Export interfaces** for component props
- **'use client' directive** at top of client components
- **React.PropsWithChildren** for components accepting children

Example:

```typescript
'use client';

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const Button = ({
  variant = 'primary',
  size = 'md',
  children,
}: React.PropsWithChildren<ButtonProps>) => {
  return <button className={getButtonClasses(variant, size)}>{children}</button>;
};

export default Button;
```

### Code Style

- **Single quotes** - Use `'` not `"` (enforced by Prettier)
- **Semicolons required** - All statements end with `;`
- **async/await** - Prefer over promise chains
- **Promise.all** - Use for parallel async operations
- **2-space indentation** - No tabs
- **80 character line width** - Wrap lines when reasonable

### Error Handling

- **TRPCError** - Use for API errors in tRPC procedures
- **Include context** - Log errors with context objects: `console.error('message', { error, data })`
- **Type-safe checks** - Verify error types: `if (!(error instanceof Error))`
- **tryCatch utility** - Use the custom `tryCatch` helper for tuple-based error handling

Example:

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

### Import Organization

Order imports as follows:

1. External libraries (React, third-party packages)
2. Internal libraries and utilities (`@/lib/`, `@/utils/`)
3. Local relative imports (`./`, `../`)
4. Type imports (can be mixed with regular imports)

Example:

```typescript
import { eq } from 'drizzle-orm';
import { useState } from 'react';

import db from '@/database/client';
import { formatPrice } from '@/utils/formatPrice';

import type { User } from './types';
import { getUserData } from './getUserData';
```

### Framework-Specific Standards

- **Zod** - Use for all input validation
- **Drizzle ORM** - Use for all database operations
- **Tailwind CSS** - Use for all styling (no CSS modules or styled-components)
- **tailwind-variants** - Use `tv()` for component style variants
- **Design tokens** - Use custom tokens: `bg-fill-primary`, `text-text-muted`

**Note:** Run `pnpm lint:fix` from `apps/web` to auto-fix formatting. ESLint and Prettier enforce these standards.

---

## Contribution Workflow

When the user requests a code change, follow this exact workflow:

### 1. Implement the Changes

- Apply the requested changes following all coding standards above
- Ensure all modified files follow the one-function-per-file policy
- Use proper TypeScript types (no `any`)
- Add TSDoc comments to new exported functions
- Follow the established patterns in the codebase

### 2. Request Permission

Before running any commands, **always ask the user for permission** to proceed with:

- Running the linter
- Committing changes
- Pushing to main
- Monitoring deployment

Example: "I've implemented the requested changes. May I proceed with linting, committing, and deploying to production?"

### 3. Run Linter

Once permission is granted, run the linter:

```bash
cd apps/web
pnpm lint
```

If linting errors occur:

- Fix all errors
- Run `pnpm lint` again to verify
- Repeat until the linter passes with no errors

### 4. Commit Changes

Create a commit with a conventional commit message:

```bash
git add .
git commit -m "type: descriptive commit message"
```

**Commit types:**

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `style:` - Formatting changes
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 5. Push to Main

Push directly to the main branch:

```bash
git push origin main
```

### 6. Monitor Deployment

After pushing:

1. Use the **Vercel MCP** to check deployment status
2. Monitor the build progress
3. Wait for the build to succeed
4. Report success to the user with deployment details

If deployment fails:

- Report the error to the user
- Do not mark the task as complete
- Wait for further instructions

**Critical:** Always follow this process in order. Do not skip steps. If any step fails, stop and report the issue to the user.

---

## Additional Guidelines

### When Reading Code

- Always examine existing patterns before implementing new features
- Match the style and structure of surrounding code
- Reuse existing utilities and components when possible

### When Making Changes

- Prefer editing existing files over creating new ones
- Follow the feature-based directory structure (`_feature/`)
- Place new utilities in the appropriate `utils/` directory
- Place new schemas in `schemas/` directories

### When Encountering Ambiguity

- Ask the user for clarification before proceeding
- Provide options when multiple valid approaches exist
- Explain trade-offs for different implementation choices

### Database Changes

- Use Drizzle schema definitions in `apps/web/src/database/schema.ts`
- Create migrations for schema changes (don't modify schema directly in production)
- Use Drizzle query builder for type-safe database operations

### API Changes

- Define tRPC procedures in `router.ts` files within feature directories
- Place business logic in `controllers/` or `data/` directories
- Use Zod schemas for input validation
- Return type-safe outputs (infer from return values)

---

## Example Workflow

**User Request:** "Add a function to calculate wine markup percentage"

**Your Response:**

1. **Implement:**

```typescript
// apps/web/src/utils/calculateMarkup.ts

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
const calculateMarkup = (cost: number, sellingPrice: number) => {
  if (cost <= 0) {
    throw new Error('Cost must be greater than zero');
  }
  return ((sellingPrice - cost) / cost) * 100;
};

export default calculateMarkup;
```

2. **Ask Permission:**
   "I've created the `calculateMarkup` utility function. May I proceed with linting, committing, and deploying?"

3. **After Permission, Execute:**

```bash
cd apps/web && pnpm lint
git add .
git commit -m "feat: add wine markup calculation utility"
git push origin main
```

4. **Monitor & Report:**
   "Deployment successful! The new `calculateMarkup` function is now live at https://[deployment-url]"

---

## Summary

As an AI agent working on this codebase:

- Follow the coding standards exactly
- Always ask permission before running commands
- Use the Vercel MCP to monitor deployments
- Report clear status updates to the user
- Stop and ask for help if anything is unclear

Your goal is to implement requested changes efficiently while maintaining code quality and following the established workflow. The user trusts you to make good technical decisions within these guidelines.
