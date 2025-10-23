# AI Agent Instructions for Craft & Culture

This document provides instructions for AI agents (LLMs) working on the Craft & Culture codebase. When you receive a contribution request, follow the guidelines, coding standards, and deployment workflow outlined below.

## Project Context

Craft & Culture is a B2B/B2C web application helping wine and spirits brands succeed in GCC markets. The platform features:

- **Product management** - Syncing wine products from CultX trading platform
- **Quote generation** - Creating quotes with multiple line items
- **Custom pricing models** - Spreadsheet-like pricing formulas
- **User management** - Magic link authentication with B2B/B2C customer types

**Tech Stack:** Next.js 15, React 19, TypeScript, PostgreSQL (Neon), Drizzle ORM, Better Auth, tRPC, Trigger.dev, Tailwind CSS 4

The user you're assisting has deep domain expertise in wine trading, regional markets, compliance, and distribution. They may request changes to business logic, pricing models, product workflows, or UI improvements. Your role is to implement their requests while maintaining code quality and following the established patterns.

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
