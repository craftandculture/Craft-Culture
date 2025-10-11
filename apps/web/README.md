# Easybooker Web Application

Next.js application for the Easybooker platform. Handles document collection, AI processing, validation, and bank matching workflows.

## Tech Stack

- Next.js 15 with App Router
- React 19 with Experimental Compiler
- TypeScript + Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- Supabase Auth
- tRPC for type-safe APIs
- Trigger.dev for background jobs
- Sentry error tracking
- AI providers for document processing

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL database
- Supabase project
- Moneybird API credentials

### Installation

```bash
# From monorepo root
pnpm install

# Set up environment
cp .env.example .env

# Push database schema
pnpm push

# Start development
pnpm dev
```

Application runs at [http://localhost:3000](http://localhost:3000).
