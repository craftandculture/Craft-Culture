# Craft & Culture Web Application

Next.js application for the Craft & Culture platform. Helps wine and spirits brands succeed in the GCC markets with product management, quote generation, and sophisticated pricing models.

## Tech Stack

- Next.js 15 with App Router
- React 19 with Experimental Compiler
- TypeScript + Tailwind CSS 4
- PostgreSQL + Drizzle ORM
- Better Auth for authentication
- tRPC for type-safe APIs
- Trigger.dev for background jobs
- Sentry error tracking
- CultX API integration for wine products

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL database (Neon recommended)
- CultX API credentials

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
