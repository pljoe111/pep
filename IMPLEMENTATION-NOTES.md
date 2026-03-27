# Peptide Crowdfunding Platform — Implementation Notes

> Generated at the end of the initial BFF implementation session.
> Build status: `pnpm --filter bff build` ✅ zero errors.

---

## Session Overview

Implemented the full backend (`packages/bff`) for the Peptide Crowdfunding Platform from scratch, guided by [`packages/bff/specs/system-spec-v3.md`](packages/bff/specs/system-spec-v3.md) and [`packages/bff/specs/AGENT-CODING-RULES.md`](packages/bff/specs/AGENT-CODING-RULES.md).

Before writing any code, both documents were read in full. Key facts confirmed from the spec:

- **7 Absolute Prohibitions** (coding rules §1): `@ts-ignore` / `@ts-expect-error` / any `eslint-disable` form; `any` except `catch`+third-party wrapping; `!` without truthful `// SAFETY:` comment; no new packages beyond spec §0 stack; no new workspace packages; never touch generated files; no `console.*` in `src/`.
- **Terminal campaign states** (spec §3.2): Exactly **2** — `resolved` and `refunded`. (No transitions out of either.)
- **`MASTER_WALLET_PRIVATE_KEY` access** (coding rules §8.3): Only two files may access it — [`src/services/solana.service.ts`](packages/bff/src/services/solana.service.ts) and [`src/workers/withdrawal.worker.ts`](packages/bff/src/workers/withdrawal.worker.ts).

---

## What Was Built

### 1. Prisma Schema — `packages/bff/prisma/schema.prisma`

25 models, 13 enums, matching spec §4 exactly.

Notable additions beyond the spec's §4 model listing:

- `is_hidden Boolean @default(false)` on `Campaign` (required by §9.12 admin hide endpoint)
- `EmailVerificationToken` model (required by §7.16 email verification flow)

DB-level `CHECK` constraints documented as comments (must be added via raw migration).

### 2. Shared DTOs — `packages/common/src/dtos/`

Nine domain DTO files with `class-validator` decorators on request objects:

| File                                                                  | Contents                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`auth.dto.ts`](packages/common/src/dtos/auth.dto.ts)                 | `RegisterDto`, `LoginDto`, `RefreshTokenDto`, `VerifyEmailDto`, response shapes                         |
| [`user.dto.ts`](packages/common/src/dtos/user.dto.ts)                 | `UserDto`, `UpdateUserDto`, `NotificationPreferencesDto`, `PublicUserProfileDto`                        |
| [`wallet.dto.ts`](packages/common/src/dtos/wallet.dto.ts)             | `WithdrawDto`, `WalletBalanceDto`, `LedgerTransactionDto`, generic `PaginatedResponseDto<T>`            |
| [`campaign.dto.ts`](packages/common/src/dtos/campaign.dto.ts)         | `CreateCampaignDto`, `CampaignDetailDto`, `CampaignListDto`, `SampleDto`, `CoaDto`, `ReactionCountsDto` |
| [`contribution.dto.ts`](packages/common/src/dtos/contribution.dto.ts) | `ContributeDto`, `ContributionDto`                                                                      |
| [`lab.dto.ts`](packages/common/src/dtos/lab.dto.ts)                   | `CreateLabDto`, `UpdateLabDto`, `LabDto`, `LabDetailDto`, `LabTestDto`, `TestDto`                       |
| [`notification.dto.ts`](packages/common/src/dtos/notification.dto.ts) | `NotificationDto`, `UnreadCountDto`, `MarkAllReadResponseDto`                                           |
| [`leaderboard.dto.ts`](packages/common/src/dtos/leaderboard.dto.ts)   | `LeaderboardEntryDto`                                                                                   |
| [`admin.dto.ts`](packages/common/src/dtos/admin.dto.ts)               | `AdminBanUserDto`, `AdminClaimDto`, `ConfigurationDto`, `AdminFeeSweepDto`, `AdminVerifyCoaDto`         |

### 3. Error Classes — `src/utils/errors.ts`

Eight classes from spec §6:

```
ValidationError          → 400
AuthenticationError      → 401
AuthorizationError       → 403
NotFoundError            → 404
ConflictError            → 409
InsufficientBalanceError → 422
RateLimitError           → 429
InternalError            → 500
```

All extend a shared `AppError` base with `toResponseBody()`. The global error middleware in `server.ts` is the **only** place that calls `res.status()`.

### 4. Environment Config — `src/config/env.config.ts`

All 30+ environment variables from spec §11 validated via `envalid`. `MASTER_WALLET_PRIVATE_KEY` has a `SECURITY:` JSDoc comment. Direct `process.env.*` access anywhere else in `src/` is forbidden.

### 5. Services (18 total)

| Service                                                                          | Spec sections      | Key notes                                                                                               |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| [`prisma.service.ts`](packages/bff/src/services/prisma.service.ts)               | §0 (ORM)           | `PrismaClient` with `@prisma/adapter-pg` for connection pooling                                         |
| [`audit.service.ts`](packages/bff/src/services/audit.service.ts)                 | §4.24              | Fire-and-forget `.catch()`; failure **never** rolls back business tx                                    |
| [`configuration.service.ts`](packages/bff/src/services/configuration.service.ts) | §4.23, §3.7        | 60-second in-memory cache; `get<T>()`, `set()`, `getAll()`                                              |
| [`auth.service.ts`](packages/bff/src/services/auth.service.ts)                   | §7.1–7.3, §7.16    | Register, login, refresh (replay-attack detection), logout, email verification                          |
| [`user.service.ts`](packages/bff/src/services/user.service.ts)                   | §9.7               | Profile, username update, notification preferences                                                      |
| [`wallet.service.ts`](packages/bff/src/services/wallet.service.ts)               | §7.5, §5.5         | Balance, deposit address, withdrawal with rolling 24 h limit                                            |
| [`notification.service.ts`](packages/bff/src/services/notification.service.ts)   | §1 design decision | Checks `notification_preferences` before inserting DB row or enqueuing email                            |
| [`lab.service.ts`](packages/bff/src/services/lab.service.ts)                     | §9.9               | Lab CRUD, approval, test-price history writes                                                           |
| [`test.service.ts`](packages/bff/src/services/test.service.ts)                   | §9.10              | Test catalog CRUD                                                                                       |
| [`leaderboard.service.ts`](packages/bff/src/services/leaderboard.service.ts)     | §9.11              | Contributors (sum USD) + creators (resolved count); banned users excluded; monthly = calendar month UTC |
| [`contribution.service.ts`](packages/bff/src/services/contribution.service.ts)   | §7.9               | SERIALIZABLE tx; threshold check and auto-advance to `funded`                                           |
| [`solana.service.ts`](packages/bff/src/services/solana.service.ts)               | §7.4, §7.5.1       | Deposit sweeps, withdrawals, balance reads; `MASTER_WALLET_PRIVATE_KEY` loaded here                     |
| [`storage.service.ts`](packages/bff/src/services/storage.service.ts)             | §1 (S3 access)     | Private S3 bucket; pre-signed URLs generated at read time; S3 key in DB, not URL                        |
| [`ocr.service.ts`](packages/bff/src/services/ocr.service.ts)                     | §7.12.1            | `pdf-parse` v1.x; regex `\b{code}\b` for verification code search                                       |
| [`coa.service.ts`](packages/bff/src/services/coa.service.ts)                     | §7.12, §7.13       | Magic-byte PDF check; re-upload guards; OCR job enqueue; admin verify/reject                            |
| [`campaign.service.ts`](packages/bff/src/services/campaign.service.ts)           | §7.6–7.15          | Full state machine; fee math with `ROUND_DOWN`; reactions, updates, COA listing                         |
| [`email.service.ts`](packages/bff/src/services/email.service.ts)                 | §10.4              | Nodemailer SMTP; fire-and-forget on failure                                                             |
| [`admin.service.ts`](packages/bff/src/services/admin.service.ts)                 | §7.17, §9.12       | Force refund, hide, ban (revokes all sessions), claim management, config CRUD, fee sweep                |

### 6. Controllers (10 total)

All routes match spec §9 API tables exactly. tsoa `@Security('jwt')` + tsyringe `@inject()` throughout.

`req.user` is typed via `src/types/express.d.ts` — a proper TypeScript namespace augmentation (no casts needed at the type level).

| Controller                                                                              | Routes                                                                                 |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`auth.controller.ts`](packages/bff/src/controllers/auth.controller.ts)                 | POST register, login, refresh, logout; GET me; POST verify-email, resend-verification  |
| [`user.controller.ts`](packages/bff/src/controllers/user.controller.ts)                 | GET/PATCH me; PATCH notification-preferences; GET :id/profile                          |
| [`wallet.controller.ts`](packages/bff/src/controllers/wallet.controller.ts)             | GET balance, deposit-address; POST withdraw; GET transactions                          |
| [`campaign.controller.ts`](packages/bff/src/controllers/campaign.controller.ts)         | Full §9.3/9.4/9.5/9.6/9.13 — includes COA upload (multipart), reactions, contributions |
| [`lab.controller.ts`](packages/bff/src/controllers/lab.controller.ts)                   | GET/POST labs; PATCH; POST approve, tests; PATCH tests/:testId                         |
| [`test.controller.ts`](packages/bff/src/controllers/test.controller.ts)                 | GET/POST/PATCH tests                                                                   |
| [`notification.controller.ts`](packages/bff/src/controllers/notification.controller.ts) | GET all, unread-count; PATCH :id/read, read-all                                        |
| [`leaderboard.controller.ts`](packages/bff/src/controllers/leaderboard.controller.ts)   | GET contributors, creators                                                             |
| [`admin.controller.ts`](packages/bff/src/controllers/admin.controller.ts)               | All §9.12 admin routes                                                                 |
| [`app-info.controller.ts`](packages/bff/src/controllers/app-info.controller.ts)         | GET /app-info — spec §9.13 shape                                                       |

### 7. Background Workers (5)

| Worker                                                                            | Frequency | Concurrency | Key behaviour                                                                                                |
| --------------------------------------------------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| [`deposit-scanner.worker.ts`](packages/bff/src/workers/deposit-scanner.worker.ts) | 30 s      | 1           | Scans all deposit addresses; `ProcessedDepositSignature` idempotency; skips unknown mints                    |
| [`withdrawal.worker.ts`](packages/bff/src/workers/withdrawal.worker.ts)           | On-demand | 1           | Checks `onchain_signature` before retry; restores balance on final failure                                   |
| [`ocr.worker.ts`](packages/bff/src/workers/ocr.worker.ts)                         | On-demand | 5           | 60 s timeout; 2 retries                                                                                      |
| [`email.worker.ts`](packages/bff/src/workers/email.worker.ts)                     | On-demand | 10          | 0 retries; logs warn on failure                                                                              |
| [`reconciliation.worker.ts`](packages/bff/src/workers/reconciliation.worker.ts)   | 1 h       | 1           | Sums ledger + escrow + fee vs on-chain master wallet; operator alert on discrepancy; **never auto-corrects** |

### 8. Background Jobs (2)

| Job                                                                                  | Frequency | Behaviour                                                                                                                         |
| ------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`deadline-monitor.job.ts`](packages/bff/src/jobs/deadline-monitor.job.ts)           | 5 min     | Skips campaigns with pending COA OCR (spec §1 design decision); triggers `refundContributions` per expired campaign independently |
| [`refresh-token-cleanup.job.ts`](packages/bff/src/jobs/refresh-token-cleanup.job.ts) | Daily     | `DELETE WHERE expires_at < now() - 7 days`                                                                                        |

### 9. Infrastructure

| File                                                                                  | Purpose                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`src/ioc.ts`](packages/bff/src/ioc.ts)                                               | Bridges tsyringe container to tsoa's `iocContainer` interface            |
| [`src/container.ts`](packages/bff/src/container.ts)                                   | All 18 singletons registered; workers started via `setImmediate`         |
| [`src/middleware/auth.middleware.ts`](packages/bff/src/middleware/auth.middleware.ts) | `expressAuthentication()` — synchronous, ban-aware, returns `JwtPayload` |
| [`src/types/express.d.ts`](packages/bff/src/types/express.d.ts)                       | Augments `Express.Request` with `user?: JwtPayload`                      |
| [`tsoa.json`](packages/bff/tsoa.json)                                                 | Added `authenticationModule` + `iocModule`; security definitions         |

---

## Key Architectural Decisions Implemented

| Decision                                                      | Where                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `SERIALIZABLE` isolation on all balance operations            | Every `prisma.$transaction(...)` that debits or credits any account            |
| Debit before credit (coding rules §5.2)                       | Contribution, withdrawal, refund flows                                         |
| `ProcessedDepositSignature` as atomic idempotency gate        | Inserted inside the same DB tx as the ledger credit                            |
| Withdrawal double-spend prevention                            | `withdrawal.worker.ts` calls `getTransaction(sig)` before resubmitting         |
| Fee math uses `ROUND_DOWN` to 6 decimal places                | `campaign.service.ts` `resolveCampaign()`                                      |
| `AuditLog` never blocks business operations                   | `audit.service.ts` `.catch()` pattern                                          |
| S3 object key in DB, pre-signed URL in API response           | `storage.service.ts` `getSignedUrl()` called at read time in every DTO mapper  |
| `notification_preferences` enforced before every notification | `notification.service.ts` `send()` checks per user per type                    |
| `MASTER_WALLET_PRIVATE_KEY` strictly isolated                 | Constructor of `solana.service.ts` only; never passed as a parameter elsewhere |

---

## Packages Added (beyond pre-existing scaffold)

Per coding rules §1.4, only packages explicitly named in spec §0 tech stack were installed.

```
# packages/bff — runtime
@solana/web3.js@1   @solana/spl-token@0.4  bull@4         ioredis
bcrypt              pino                   class-validator class-transformer
jsonwebtoken        multer                 file-type@16   pdf-parse@1
nodemailer          @aws-sdk/client-s3     @aws-sdk/s3-request-presigner
@prisma/adapter-pg  pg                     express-rate-limit  bs58

# packages/bff — devDependencies
@types/bcrypt  @types/jsonwebtoken  @types/multer  @types/nodemailer  @types/pg@8.11.11  @types/pdf-parse

# packages/common — runtime
class-validator  class-transformer
```

> **Note on `bs58`**: added as a direct dependency because it was required to decode the base58-encoded `MASTER_WALLET_PRIVATE_KEY` env var (spec §11 format). It is a transitive dependency of `@solana/web3.js` but pnpm's isolation prevented it from being directly importable without an explicit declaration.

> **Note on `pdf-parse@1`**: `pdf-parse@2.x` (installed by pnpm initially) is a completely different ESM-only package with a class-based API. Downgraded to `^1.1.4` which matches the spec's intended function-call API.

---

## Build Pipeline

```
pnpm --filter common build  ✅  (TypeScript compilation)
pnpm --filter bff build     ✅  (prisma generate → tsoa spec-and-routes → tsc)
```

The VS Code language server showed many false-positive `ts Error` diagnostics throughout the session (stale Prisma client cache in the IDE). The `tsc --noEmit` CLI was used as the authoritative source of truth — it reported zero errors for all service/controller/worker/job files.
