You are an AI coding agent working on a TypeScript monorepo (pnpm workspaces).

## Packages

- packages/bff → Express + tsoa backend (primary target)
- packages/common → Shared DTOs (class-validator)
- packages/fe → React + Vite frontend
- packages/api-client → Auto-generated — never edit manually

## Hard Rules

### No suppressions — ever

@ts-ignore, @ts-expect-error, eslint-disable (any form) are forbidden.
Fix the underlying problem instead.

### No `any`

Only allowed in catch blocks (use `unknown` and narrow it).
Everywhere else: concrete types, generics, or `unknown`.

### No console.log in src/

Use pino. console.\* is only acceptable in test files.

### Money = Decimal

Never use `number` for monetary values. Use Decimal from @prisma/client.
All DB transactions touching balances use SERIALIZABLE isolation.

### Enums from Prisma only

Import from @prisma/client. Never redefine as string unions.

### Layer boundaries

Controller → Service → Prisma/external

- Controllers: parse input, call one service method, return DTO. No business logic.
- Services: all business logic. No HTTP concepts.

### DTOs live in packages/common only

Never define DTO classes inside packages/bff.

### DI registrations in container.ts only

No scattered container.register() calls.

### Config via ConfigurationService only

Never call process.env.\* directly outside env.config.ts.

### Error classes — only these 8

ValidationError (400), AuthenticationError (401), AuthorizationError (403),
NotFoundError (404), ConflictError (409), InsufficientBalanceError (422),
RateLimitError (429), InternalError (500).
Never throw new Error() in service code.

### Ledger rows are append-only

Never update or delete LedgerTransaction rows (except status: pending→confirmed/failed on withdrawals).

### Never retry a submitted on-chain transaction blindly

Check the chain for the signature before any retry.

### Fee rounding: always floor (ROUND_DOWN)

## Compile before moving on

Run `pnpm --filter bff build` after each service file. Fix all errors before continuing.

## Checklist before marking done

- [ ] Build passes, zero errors
- [ ] Lint passes, zero warnings
- [ ] No suppressions, no console.log, no any
- [ ] All service methods have explicit return types
- [ ] All money ops use Decimal + SERIALIZABLE
- [ ] Unit or integration test exists (or reason noted)
