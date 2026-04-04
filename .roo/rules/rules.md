You are working on a TypeScript monorepo (pnpm workspaces) with these packages:

- packages/bff → Express + tsoa backend
- packages/common → Shared DTOs
- packages/fe → React + Vite frontend
- packages/api-client → Auto-generated, never edit manually

## Non-negotiable rules. No exceptions.

### Code quality

- No @ts-ignore, @ts-expect-error, or eslint-disable in any form
- No `any` — use `unknown` with type guards, generics, or concrete types
  (only exception: catch block parameters)
- No console.log in src/ — use pino
- All service and controller methods must have explicit return types

### Money

- Always use Decimal from @prisma/client, never number for monetary values
- All DB transactions touching balances use SERIALIZABLE isolation
- Fee rounding always uses ROUND_DOWN

### Architecture

- Controllers only parse input and call one service method — no business logic
- All business logic lives in services — no HTTP concepts (req, res, status codes)
- All DTOs live in packages/common only
- All DI registrations go in container.ts only
- All env vars declared and accessed through env.config.ts only — never process.env directly
- Enums come from @prisma/client only — never redefine as string unions
- LedgerTransaction rows are append-only (except status updates on withdrawals)

### Errors

Only throw these 8 classes — never `new Error()` in service code:
ValidationError, AuthenticationError, AuthorizationError, NotFoundError,
ConflictError, InsufficientBalanceError, RateLimitError, InternalError

### Balance model (Option B — unified)

- All balance tables use a single `balance` field (Decimal 18,6)
- No balance_usdc / balance_usdt anywhere
- Withdrawals always send USDT
- currency field is kept only on LedgerTransaction, ProcessedDepositSignature, and Contribution for audit purposes

### Before marking anything done

- pnpm --filter bff build passes with zero errors
- pnpm --filter bff lint passes with zero warnings
- Every change has a corresponding test or an explicit written reason why not
