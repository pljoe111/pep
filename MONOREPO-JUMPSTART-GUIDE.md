# Monorepo Jumpstart Guide

Deep-dive architecture reference for maintainers and new contributors.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How TSOA → OpenAPI → api-client Works](#how-tsoa--openapi--api-client-works)
3. [Adding a New Package](#adding-a-new-package)
4. [Adding a New Controller/Service](#adding-a-new-controllerservice)
5. [Prisma: Schema Changes & Migrations](#prisma-schema-changes--migrations)
6. [Git Hooks](#git-hooks)
7. [CI/CD](#cicd)
8. [Docker](#docker)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  pnpm workspace (root)                                  │
│                                                         │
│  ┌──────────┐   ┌────────────┐                          │
│  │ common   │──▶│ api-client │                          │
│  │ (types)  │   │ (generated)│                          │
│  └──────────┘   └─────┬──────┘                          │
│       │               │                                 │
│       ▼               ▼                                 │
│  ┌──────────┐   ┌────────────┐                          │
│  │   bff    │   │     fe     │                          │
│  │ (Express)│   │  (React)   │                          │
│  └──────────┘   └────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Dependency chain**: `common → api-client → bff → fe`

- `common` has no internal workspace deps — pure types and tiny utils
- `api-client` depends on `common` (for shared types) and on bff's generated OpenAPI spec
- `bff` depends on `common`
- `fe` depends on `api-client`

---

## How TSOA → OpenAPI → api-client Works

```
TSOA decorators in controllers
        │
        ▼
pnpm tsoa:spec-and-routes
        │
        ├──▶ packages/bff/src/generated/swagger.json   (OpenAPI 3.0 spec)
        └──▶ packages/bff/src/generated/routes.ts      (Express router)
                                │
                                ▼
            pnpm --filter api-client generate
                                │
                                ▼
            packages/api-client/src/generated/         (TypeScript + Axios)
```

The root `pnpm generate:client` script runs both steps in order.

**Key files:**

- `packages/bff/tsoa.json` — TSOA configuration (controller globs, spec output path, base path)
- `packages/bff/src/generated/` — gitignored, always regenerated
- `packages/api-client/src/generated/` — gitignored, always regenerated
- `packages/api-client/openapitools.json` — openapi-generator-cli version pin

**After clone**, run `pnpm generate:client` before `pnpm build`.

---

## Adding a New Package

1. **Create directory**: `packages/my-package/`

2. **`package.json`**:

   ```json
   {
     "name": "my-package",
     "version": "1.0.0",
     "private": true,
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "lint": "eslint . --ext ts --max-warnings 0",
       "format": "prettier --write \"src/**/*.ts\""
     },
     "devDependencies": {
       "typescript": "^5.3.3"
     }
   }
   ```

3. **`tsconfig.json`**:

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "composite": true,
       "outDir": "./dist",
       "rootDir": "./src",
       "noEmit": false
     },
     "include": ["src"],
     "exclude": ["node_modules", "dist", "**/*.test.ts"]
   }
   ```

4. **`.eslintrc.json`**: Copy from `packages/common/.eslintrc.json` and adjust `env`.

5. **Add to root `tsconfig.json` references**:

   ```json
   { "path": "packages/my-package" }
   ```

6. **Add to root scripts** in `package.json` (`build:my-package`, `lint`, etc.)

7. **pnpm install** — pnpm auto-discovers all packages in `packages/*`.

> **Note:** The root `tsconfig.json` is a solution-style config pointing to sub-packages via `references`. Shared compiler options live in `tsconfig.base.json`, which sub-packages extend.

---

## Adding a New Controller/Service

### 1. Define the DTO in `packages/common`

```typescript
// packages/common/src/dtos/my-feature.dto.ts
export interface MyFeatureDto {
  id: string;
  name: string;
}
```

Re-export from `packages/common/src/index.ts`.

### 2. Create the Service

```typescript
// packages/bff/src/services/my-feature.service.ts
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import type { MyFeatureDto } from 'common';

@injectable()
export class MyFeatureService {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  async findAll(): Promise<MyFeatureDto[]> {
    const items = await this.prisma.item.findMany();
    return items.map((item) => ({ id: item.id, name: item.name }));
  }
}
```

### 3. Register in the DI Container

```typescript
// packages/bff/src/container.ts
import { MyFeatureService } from './services/my-feature.service';
container.registerSingleton(MyFeatureService);
```

### 4. Create the Controller

```typescript
// packages/bff/src/controllers/my-feature.controller.ts
import { Controller, Get, Route, Tags, Inject } from 'tsoa';
import type { MyFeatureDto } from 'common';
import { MyFeatureService } from '../services/my-feature.service';
import { container } from '../container';

@Route('my-feature')
@Tags('MyFeature')
export class MyFeatureController extends Controller {
  private service = container.resolve(MyFeatureService);

  @Get('/')
  public async getAll(): Promise<MyFeatureDto[]> {
    return this.service.findAll();
  }
}
```

### 5. Regenerate + Rebuild

```bash
pnpm generate:client   # regenerates routes + OpenAPI + api-client
pnpm build             # full rebuild
```

---

## Prisma: Schema Changes & Migrations

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply migration
pnpm --filter bff prisma:migrate

# 3. Prisma Client is auto-regenerated after migration
# 4. Rebuild bff if types changed
pnpm build:bff
```

**Production**: migrations run automatically on container startup via `prisma migrate deploy`.

---

## Git Hooks

| Hook         | Trigger      | Action                                   |
| ------------ | ------------ | ---------------------------------------- |
| `pre-commit` | `git commit` | `lint-staged` (prettier on staged files) |
| `pre-push`   | `git push`   | `pnpm build` (full build)                |

Hooks source `nvm` and call `nvm use` if `.nvmrc` exists.

To skip a hook (emergency only): `git commit --no-verify`

---

## CI/CD

GitHub Actions runs on push/PR to `main` or `develop`:

1. Spin up PostgreSQL 16
2. Install Node 24 + pnpm 10
3. Cache pnpm store (keyed on `pnpm-lock.yaml`)
4. `pnpm install --frozen-lockfile`
5. `pnpm build`
6. `pnpm test:bff`
7. On push (not PR): create release zip, tag commit, create GitHub Release

Releases on `develop` are marked pre-release. Releases on `main` are stable.

---

## Docker

### Build Individually

```bash
# BFF
docker build -f Dockerfile.bff -t my-bff .

# Frontend (with custom API URL)
docker build -f Dockerfile.fe --build-arg VITE_API_URL=https://api.example.com -t my-fe .
```

### Multi-stage Details

**Dockerfile.bff**:

- Stage `builder`: full deps, builds `common` + `bff`
- Stage `production`: prod deps only, runs as non-root, uses `dumb-init`
- Entrypoint: `prisma migrate deploy && node dist/server.js`

**Dockerfile.fe**:

- Stage `builder`: full deps, builds `common` + `api-client` + `fe`
- Stage `production`: nginx:alpine with SPA config, gzip, security headers, `/health`

---

## Troubleshooting

### "Cannot find module 'common'"

Build `common` first: `pnpm build:common`. The workspace symlink points to `dist/`, which must exist.

### "Cannot find module './generated/routes'"

Run `pnpm generate:client` to generate TSOA routes. The generated directory is gitignored.

### Prisma Client not generated

Run `pnpm --filter bff prisma:generate`. This is normally done automatically during `pnpm build`.

### Git hooks not running

Make sure hooks are executable: `chmod +x .husky/pre-commit .husky/pre-push`

### `pnpm install --frozen-lockfile` fails in CI

Someone added/changed a dependency without committing `pnpm-lock.yaml`. Run `pnpm install` locally and commit the lockfile.

### Docker: Prisma generate fails on ARM (M1/M2/M3)

Add `binaryTargets` to `schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]
}
```

### Vite can't reach the BFF

Check that `VITE_API_URL` points to the correct BFF URL, or that the Vite proxy (`/api → http://localhost:3000`) is running.
