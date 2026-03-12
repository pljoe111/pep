# My Monorepo

A production-ready TypeScript monorepo. Four packages, strict build dependency chain, full CI/CD and Docker support.

```
common → api-client → bff → fe
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp packages/bff/.env.example packages/bff/.env
# Edit packages/bff/.env — set DATABASE_URL at minimum

# 3. Start PostgreSQL (via Docker)
docker compose up postgres -d

# 4. Run migrations
pnpm --filter bff prisma:migrate

# 5. Generate TSOA routes + OpenAPI spec + API client
pnpm generate:client

# 6. Build all packages
pnpm build

# 7. Start dev servers (two terminals)
pnpm dev:bff   # → http://localhost:3000  (Swagger at /api-docs)
pnpm dev:fe    # → http://localhost:5173
```

## Packages

| Package | Description |
|---------|-------------|
| `packages/common` | Shared TypeScript types and utilities |
| `packages/bff` | Express + TSOA + Prisma backend |
| `packages/api-client` | Auto-generated Axios client from OpenAPI spec |
| `packages/fe` | React + Vite + React Router frontend |

## Build Order

**Critical** — always build in this order:

```
common → api-client → bff → fe
```

The root `pnpm build` script enforces this order automatically.

## Available Scripts

```bash
# Development
pnpm dev:bff              # Start BFF in watch mode
pnpm dev:fe               # Start frontend with HMR

# Build
pnpm build                # Build all packages in order (+ lint)
pnpm build:common         # Build common only
pnpm build:api-client     # Generate client + build
pnpm build:bff            # Build BFF only
pnpm build:fe             # Build frontend only

# Code quality
pnpm lint                 # ESLint all packages
pnpm format               # Prettier all packages
pnpm format:check         # Prettier check (no writes)

# API generation
pnpm generate:client      # tsoa spec → OpenAPI → api-client

# Testing
pnpm test:bff             # Run BFF Vitest tests

# Prisma (run from packages/bff or use --filter)
pnpm --filter bff prisma:migrate    # Create + apply migration
pnpm --filter bff prisma:studio     # Open Prisma Studio
```

## Docker

```bash
# Full stack (postgres + bff + fe)
docker compose up --build

# Individual services
docker compose up postgres -d
docker compose up bff -d
docker compose up fe -d

# With custom env
POSTGRES_PASSWORD=secret BFF_PORT=4000 docker compose up --build
```

Services:
- `fe` → http://localhost:8080
- `bff` → http://localhost:3000 (Swagger at /api-docs)
- `postgres` → localhost:5432

## After Fresh Clone

```bash
pnpm install
cp packages/bff/.env.example packages/bff/.env
# edit .env
docker compose up postgres -d
pnpm --filter bff prisma:migrate
pnpm generate:client
pnpm build
```

## Requirements

- Node.js 24.x (`nvm use` reads `.nvmrc`)
- pnpm 10.x (`corepack enable`)
- Docker + Docker Compose (for local postgres)
