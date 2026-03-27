# Peptide Crowdfunding Platform — System Specification v3

> **For implementation agents:** This document is the single source of truth for
> what to build. Read `AGENT-CODING-RULES.md` for how to build it. Every
> decision is made here. Where something is not specified, the coding rules
> govern. Do not invent behavior for financial flows, state transitions, or
> security decisions — stop and ask.

---

## 0. Technology Stack

| Layer            | Technology                                     | Version / Notes                              |
| ---------------- | ---------------------------------------------- | -------------------------------------------- |
| Runtime          | Node.js                                        | 20 LTS                                       |
| Language         | TypeScript strict mode                         | 5.x                                          |
| Framework        | Express + tsoa                                 | decorator routing, generates OpenAPI spec    |
| DI Container     | tsyringe                                       |                                              |
| ORM              | Prisma + `@prisma/adapter-pg`                  | connection pooling via `pg`                  |
| Database         | PostgreSQL                                     | 15+                                          |
| Job Queue        | Bull 4 + ioredis                               | backed by Redis 7                            |
| Blockchain       | `@solana/web3.js` v1, `@solana/spl-token` v0.4 | devnet for dev/test, mainnet for prod        |
| Auth             | JWT                                            | access 15 min, refresh 7 days (stored in DB) |
| Password hashing | bcrypt                                         | cost factor 12                               |
| Encryption       | AES-256-GCM                                    | deposit address private keys at rest         |
| File storage     | AWS S3 / S3-compatible (MinIO)                 | COA PDFs only; private bucket + signed URLs  |
| File type check  | `file-type` library                            | magic-byte validation (not Content-Type)     |
| OCR              | `pdf-parse` + string search                    | extract text, find verification code         |
| Email            | Nodemailer                                     | SMTP configurable via env                    |
| Logging          | pino                                           | never `console.*` in `src/`                  |
| Validation       | class-validator + class-transformer            | on DTO classes in `packages/common`          |
| Testing          | Vitest (unit), Jest + ts-jest (integration)    |                                              |
| Package manager  | pnpm workspaces                                |                                              |

### Monorepo Package Map

| Package      | Path                  | Role                                                   |
| ------------ | --------------------- | ------------------------------------------------------ |
| `bff`        | `packages/bff`        | Express backend — primary implementation target        |
| `common`     | `packages/common`     | Shared DTO classes (class-validator decorated)         |
| `fe`         | `packages/fe`         | React + Vite frontend (consumes `api-client` only)     |
| `api-client` | `packages/api-client` | Auto-generated from swagger.json — never edit manually |

---

## 1. Explicit Design Decisions

The following decisions are final. Do not re-evaluate them.

| Topic                                  | Decision                                                                                                                                                                                                                                     | Rationale                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Over-funding                           | Allowed. Contributions accepted while `status IN ('created','funded')` with no cap. Creator receives full escrow (minus fee) on resolution.                                                                                                  | Spec keeps it simple; surplus rewards the creator for strong community trust.               |
| Refresh token storage                  | Stored in `refresh_token` DB table. Single-use: each use rotates to a new token and invalidates the old one.                                                                                                                                 | Required for ban enforcement and session revocation.                                        |
| Multi-currency payout                  | USDC and USDT paid out separately in full. `current_funding_usd` is the aggregate display field; escrow tracks both currencies independently.                                                                                                | Simpler than conversion; avoids FX complexity.                                              |
| `funded_at` vs `locked_at`             | `funded_at` is set the first time the campaign crosses the threshold (auto or manual). `locked_at` is set only on explicit creator lock. `deadline_ship_samples` is always `funded_at + 7 days`, not `locked_at + 7 days`.                   | Prevents the creator from gaming extra shipping time by delaying a manual lock.             |
| Deadline + OCR race                    | Before triggering a refund, the deadline monitor checks that no COA for the campaign has `verification_status = 'pending'`. If any COA is pending OCR, the monitor skips that campaign and retries on the next cycle.                        | Prevents refunding a campaign where the creator uploaded a valid COA seconds before expiry. |
| Estimated lab cost snapshot            | `estimated_lab_cost_usd` is computed at campaign creation time and stored on the `campaign` row. It is not recomputed at display time. Lab prices can change after campaign creation.                                                        | Prevents post-creation price changes from invalidating an already-approved campaign.        |
| S3 file access                         | Bucket is private. `file_url` stored in DB is the S3 object key, not a public URL. All `CoaDto.file_url` responses return a pre-signed URL generated at read time with a 1-hour TTL.                                                         | Prevents public exposure of COA documents.                                                  |
| Deposit scanner strategy               | Scan all deposit addresses but batch RPC calls using `getMultipleAccountsInfo` where possible. Process addresses with recent activity first.                                                                                                 | Prevents RPC rate limits at scale.                                                          |
| Withdrawal retry safety                | Before retrying a failed withdrawal job, check the chain for the `onchain_signature`. If found (tx landed but confirmation timed out), update status to `confirmed` and do NOT re-submit.                                                    | Prevents double-spend on retry.                                                             |
| Leaderboard definition                 | Contributors ranked by total `amount_usd` sum across `completed` contributions from non-banned, non-refunded campaigns. Creators ranked by count of `resolved` campaigns. `monthly` = calendar month UTC. Banned users excluded from both.   |                                                                                             |
| Rolling withdrawal limit               | Counted by number of `LedgerTransaction` rows with `transaction_type = 'withdrawal'` and `status IN ('pending','confirmed')` created in the last 24 hours for that user. Pending counts against the limit.                                   | Prevents submitting 5 and letting them queue.                                               |
| `notification_preferences` enforcement | `NotificationService.send()` checks the target user's preferences before inserting a `Notification` row or enqueuing an email. If `in_app: false`, no DB row. If `email: false`, no email job.                                               |                                                                                             |
| AuditLog                               | Written by a shared `AuditService` injected into any service that performs a state-mutating operation. Each flow section below lists the required `action` string and `entity_type`.                                                         |                                                                                             |
| Email verification                     | `email_verified` field exists and is set to `false` on registration. A verification email is sent. Unverified users may log in and browse but **cannot create campaigns or contribute**. The verification flow is specified in section 7.14. |                                                                                             |
| COA re-upload blocking                 | Re-upload is blocked while `verification_status = 'pending'` (OCR in progress). The guard checks for this explicitly and throws `ConflictError`.                                                                                             |                                                                                             |
| `PATCH /campaigns/:id` fields          | Only `title`, `description`, `is_itemized`, `itemization_data` are editable. `amount_requested_usd`, `funding_threshold_percent`, samples, and tests are immutable after creation.                                                           |                                                                                             |
| Campaign deletion                      | A creator may delete their own campaign only when `status = 'created'` AND `current_funding_usd = 0` (no contributions yet). This triggers a hard delete of the campaign row (samples cascade).                                              |                                                                                             |

---

## 2. Architecture: On-Ramp / Off-Ramp + Internal Ledger

### 2.1 Core Principle

Users deposit USDC/USDT on-chain to a personal deposit address. The app immediately
sweeps those tokens to a single **master wallet** and records the credit as an internal
ledger balance. All campaign operations move ledger entries only — no on-chain
transactions occur mid-flow. Withdrawals are the only on-chain transfers out of the
master wallet.

### 2.2 What Goes On-Chain vs Off-Chain

| Operation                                       | On-chain? | Notes                             |
| ----------------------------------------------- | --------- | --------------------------------- |
| User deposit (user → deposit address)           | Yes       | User-initiated                    |
| Deposit sweep (deposit address → master wallet) | Yes       | App-initiated, one tx per deposit |
| Contribution (user balance → campaign escrow)   | **No**    | DB ledger only                    |
| Refund (campaign escrow → contributor balances) | **No**    | DB ledger only                    |
| Fee deduction                                   | **No**    | DB ledger only                    |
| Creator payout (escrow → creator ledger)        | **No**    | DB ledger only                    |
| Withdrawal (master wallet → external address)   | Yes       | App-initiated via worker          |
| Fee sweep (master wallet → operator wallet)     | Yes       | Admin-triggered withdrawal        |

### 2.3 DB Transactions as Escrow

All balance-moving operations use `SERIALIZABLE` PostgreSQL transactions.
A contribution atomically: debits user balance, credits campaign escrow,
updates `campaign.current_funding_usd`, inserts contribution row, inserts
ledger_transaction row — or fully rolls back. See coding rules section 3.5.

### 2.4 Auditability

The master wallet's on-chain history is the complete record of all real-money flows.
Internal `LedgerTransaction` rows cross-reference on-chain signatures where applicable.
A reconciliation job (section 10.6) verifies ledger sums match on-chain balances.

---

## 3. Campaign State Machine

### 3.1 States

| State               | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `created`           | Campaign live, accepting contributions                               |
| `funded`            | Threshold reached (auto on threshold cross, or creator early-locked) |
| `samples_sent`      | Creator confirmed samples shipped to lab                             |
| `results_published` | All COAs uploaded and verified — awaiting resolution                 |
| `resolved`          | Funds released to creator ledger; terminal state                     |
| `refunded`          | All contributions returned to contributors; terminal state           |

### 3.2 Valid Transitions

```
created ──[threshold crossed OR creator locks]──────────────► funded
funded ──[creator ships samples]────────────────────────────► samples_sent
samples_sent ──[all COAs verified]──────────────────────────► results_published
results_published ──[resolveCampaign called]────────────────► resolved
any non-terminal state ──[deadline expired OR admin force]──► refunded
```

**Terminal states:** `resolved` and `refunded`. No transitions out.

**`is_flagged_for_review`** is a side flag, not a state. It can be set on any
non-terminal campaign. It does not block automatic state transitions.
A COA rejection sets this flag but leaves `status` unchanged.

### 3.3 Transitions That MUST Throw `ConflictError`

| Call                  | Condition that triggers ConflictError                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lockCampaign`        | `status ≠ 'created'` OR `current_funding_usd < funding_threshold_usd`                                                                                           |
| `shipSamples`         | `status ≠ 'funded'`                                                                                                                                             |
| `uploadCoa`           | `status ≠ 'samples_sent'` OR existing COA has `verification_status IN ('code_found','manually_approved')` OR existing COA has `verification_status = 'pending'` |
| `resolveCampaign`     | `status ≠ 'results_published'`                                                                                                                                  |
| `refundContributions` | `status IN ('resolved','refunded')`                                                                                                                             |
| `deleteCampaign`      | `status ≠ 'created'` OR `current_funding_usd > 0`                                                                                                               |

### 3.4 Deadline Rules

| Status         | Deadline Field             | Set When                 | Value                       | Expiry Action |
| -------------- | -------------------------- | ------------------------ | --------------------------- | ------------- |
| `created`      | `deadline_fundraising`     | Campaign created         | `created_at + 14 days`      | Refund        |
| `funded`       | `deadline_ship_samples`    | `funded_at` is first set | `funded_at + 7 days`        | Refund        |
| `samples_sent` | `deadline_publish_results` | Status → `samples_sent`  | `samples_sent_at + 21 days` | Refund        |

`deadline_ship_samples` is set to `funded_at + 7 days` when `funded_at` is first
written (either on auto-threshold-cross or on the first call that sets `funded_at`).
It is NOT reset if the creator calls `lockCampaign` after `funded_at` is already set.

---

## 4. Data Models

> All PKs are UUIDs (`gen_random_uuid()`). All timestamps are TIMESTAMPTZ (UTC).
> All monetary fields use Prisma `Decimal` (PostgreSQL `NUMERIC`) — never `Float`.

### 4.1 User

```prisma
model User {
  id                       String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email                    String   @unique @db.VarChar(255)
  password_hash            String   @db.VarChar(255)
  username                 String?  @unique @db.VarChar(50)
  is_banned                Boolean  @default(false)
  email_verified           Boolean  @default(false)
  notification_preferences Json     @default("{}")
  created_at               DateTime @default(now()) @db.Timestamptz
  updated_at               DateTime @updatedAt @db.Timestamptz

  @@index([email])
  @@index([username])
  @@map("user")
}
```

`notification_preferences` default:

```json
{
  "campaign_funded": { "email": true, "in_app": true },
  "campaign_locked": { "email": true, "in_app": true },
  "samples_shipped": { "email": false, "in_app": true },
  "coa_uploaded": { "email": true, "in_app": true },
  "campaign_refunded": { "email": true, "in_app": true },
  "campaign_resolved": { "email": true, "in_app": true },
  "deposit_confirmed": { "email": false, "in_app": true },
  "withdrawal_sent": { "email": true, "in_app": true },
  "withdrawal_failed": { "email": true, "in_app": true }
}
```

### 4.2 UserClaim

Roles stored as claim rows, not columns on User.

```prisma
model UserClaim {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id            String    @db.Uuid
  claim_type         ClaimType
  granted_at         DateTime  @default(now()) @db.Timestamptz
  granted_by_user_id String?   @db.Uuid

  @@unique([user_id, claim_type])
  @@index([user_id])
  @@map("user_claim")
}

enum ClaimType {
  campaign_creator
  contributor
  lab_approver
  admin
}
```

**On registration:** grant `campaign_creator` and `contributor` to every new user automatically.

### 4.3 RefreshToken

Stored in DB to enable single-use rotation and revocation on ban.

```prisma
model RefreshToken {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String   @db.Uuid
  token_hash String   @unique @db.VarChar(64)  -- SHA-256 hex of the raw token
  expires_at DateTime @db.Timestamptz
  used_at    DateTime? @db.Timestamptz          -- set when rotated; row kept for audit
  created_at DateTime @default(now()) @db.Timestamptz
  ip_address String?  @db.VarChar(45)

  @@index([user_id])
  @@index([expires_at])
  @@map("refresh_token")
}
```

**Rotation:** on `POST /auth/refresh`, mark the incoming token's `used_at = now()`,
insert a new token row, return the new raw token. If `used_at IS NOT NULL` on the
incoming token → the token was already used → throw `AuthenticationError`
(possible token replay attack — invalidate ALL tokens for this user as a precaution).

**Expiry cleanup:** a daily background job (Bull repeatable) hard-deletes rows
where `expires_at < now() - 7 days`.

**On ban:** `DELETE FROM refresh_token WHERE user_id = ?` immediately revokes all sessions.

### 4.4 LedgerAccount

One row per user. Source of truth for spendable balance.

```prisma
model LedgerAccount {
  id                      String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id                 String   @unique @db.Uuid
  balance_usdc            Decimal  @default(0) @db.Decimal(18, 6)
  balance_usdt            Decimal  @default(0) @db.Decimal(18, 6)
  lifetime_deposited_usdc Decimal  @default(0) @db.Decimal(18, 6)
  lifetime_deposited_usdt Decimal  @default(0) @db.Decimal(18, 6)
  lifetime_withdrawn_usdc Decimal  @default(0) @db.Decimal(18, 6)
  lifetime_withdrawn_usdt Decimal  @default(0) @db.Decimal(18, 6)
  created_at              DateTime @default(now()) @db.Timestamptz
  updated_at              DateTime @updatedAt @db.Timestamptz

  @@map("ledger_account")
}
```

DB-level check constraints (add via raw SQL migration):

```sql
ALTER TABLE ledger_account ADD CONSTRAINT balance_usdc_non_negative CHECK (balance_usdc >= 0);
ALTER TABLE ledger_account ADD CONSTRAINT balance_usdt_non_negative CHECK (balance_usdt >= 0);
```

Created atomically in the same transaction as user registration.

### 4.5 DepositAddress

One per user. Funds swept to master wallet immediately on detection.

```prisma
model DepositAddress {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String   @unique @db.Uuid
  public_key            String   @unique @db.VarChar(44)  -- base58 Solana address
  encrypted_private_key String   @db.Text                 -- AES-256-GCM; never returned by API
  created_at DateTime @default(now()) @db.Timestamptz

  @@map("deposit_address")
}
```

### 4.6 ProcessedDepositSignature

Idempotency guard. One row per successfully processed deposit.

```prisma
model ProcessedDepositSignature {
  id                         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  signature                  String   @unique @db.VarChar(88)
  deposit_address_public_key String   @db.VarChar(44)
  amount                     Decimal  @db.Decimal(18, 6)
  currency                   Currency
  processed_at               DateTime @default(now()) @db.Timestamptz

  @@index([deposit_address_public_key])
  @@map("processed_deposit_signature")
}
```

### 4.7 Campaign

```prisma
model Campaign {
  id                        String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  creator_id                String         @db.Uuid
  verification_code         Int            @unique
  title                     String         @db.VarChar(200)
  description               String         @db.Text
  amount_requested_usd      Decimal        @db.Decimal(10, 2)
  funding_threshold_percent Int
  funding_threshold_usd     Decimal        @db.Decimal(10, 2)
  current_funding_usd       Decimal        @default(0) @db.Decimal(10, 2)
  estimated_lab_cost_usd    Decimal        @db.Decimal(10, 2)  -- snapshotted at creation
  status                    CampaignStatus @default(created)
  is_itemized               Boolean        @default(false)
  itemization_data          Json?
  is_flagged_for_review     Boolean        @default(false)
  flagged_reason            String?        @db.Text
  platform_fee_percent      Decimal        @db.Decimal(5, 2)   -- snapshotted at creation
  created_at                DateTime       @default(now()) @db.Timestamptz
  funded_at                 DateTime?      @db.Timestamptz
  locked_at                 DateTime?      @db.Timestamptz
  samples_sent_at           DateTime?      @db.Timestamptz
  results_published_at      DateTime?      @db.Timestamptz
  resolved_at               DateTime?      @db.Timestamptz
  refunded_at               DateTime?      @db.Timestamptz
  refund_reason             String?        @db.Text
  deadline_fundraising      DateTime       @db.Timestamptz
  deadline_ship_samples     DateTime?      @db.Timestamptz
  deadline_publish_results  DateTime?      @db.Timestamptz

  @@index([creator_id])
  @@index([status])
  @@index([verification_code])
  @@index([created_at])
  @@map("campaign")
}

enum CampaignStatus {
  created
  funded
  samples_sent
  results_published
  resolved
  refunded
}
```

DB check constraints:

```sql
ALTER TABLE campaign ADD CONSTRAINT amount_requested_positive CHECK (amount_requested_usd > 0);
ALTER TABLE campaign ADD CONSTRAINT threshold_percent_range CHECK (funding_threshold_percent BETWEEN 5 AND 100);
```

### 4.8 CampaignEscrow

One per campaign. Internal balance only — no on-chain wallet.

```prisma
model CampaignEscrow {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id  String   @unique @db.Uuid
  balance_usdc Decimal  @default(0) @db.Decimal(18, 6)
  balance_usdt Decimal  @default(0) @db.Decimal(18, 6)
  created_at   DateTime @default(now()) @db.Timestamptz
  updated_at   DateTime @updatedAt @db.Timestamptz

  @@map("campaign_escrow")
}
```

DB check constraints:

```sql
ALTER TABLE campaign_escrow ADD CONSTRAINT escrow_usdc_non_negative CHECK (balance_usdc >= 0);
ALTER TABLE campaign_escrow ADD CONSTRAINT escrow_usdt_non_negative CHECK (balance_usdt >= 0);
```

### 4.9 FeeAccount

Exactly one row, seeded at migration time. Never insert a second row.

```prisma
model FeeAccount {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  balance_usdc Decimal  @default(0) @db.Decimal(18, 6)
  balance_usdt Decimal  @default(0) @db.Decimal(18, 6)
  updated_at   DateTime @updatedAt @db.Timestamptz

  @@map("fee_account")
}
```

### 4.10 LedgerTransaction

Append-only. The only permitted UPDATE is setting `status` from `pending` to
`confirmed` or `failed` on a withdrawal/fee-sweep transaction.

```prisma
model LedgerTransaction {
  id                String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  transaction_type  TransactionType
  amount            Decimal         @db.Decimal(18, 6)
  currency          Currency
  from_account_type AccountType
  from_account_id   String?         @db.Uuid
  to_account_type   AccountType
  to_account_id     String?         @db.Uuid
  external_address  String?         @db.VarChar(44)
  onchain_signature String?         @db.VarChar(88)
  reference_id      String?         @db.Uuid
  status            TxStatus        @default(completed)
  created_at        DateTime        @default(now()) @db.Timestamptz

  @@index([from_account_type, from_account_id])
  @@index([to_account_type, to_account_id])
  @@index([onchain_signature])
  @@index([transaction_type])
  @@index([status])
  @@index([reference_id])
  @@index([created_at])
  @@map("ledger_transaction")
}

enum TransactionType { deposit withdrawal contribution refund payout fee }
enum Currency        { usdc usdt }
enum AccountType     { user campaign master fee external }
enum TxStatus        { completed pending confirmed failed }
```

**Type → account mapping (enforce in service code, not just documentation):**

| Type         | from_account_type | from_account_id | to_account_type | to_account_id  |
| ------------ | ----------------- | --------------- | --------------- | -------------- |
| deposit      | external          | null            | user            | user.id        |
| withdrawal   | user              | user.id         | external        | null           |
| contribution | user              | user.id         | campaign        | campaign.id    |
| refund       | campaign          | campaign.id     | user            | contributor.id |
| payout       | campaign          | campaign.id     | user            | creator.id     |
| fee          | campaign          | campaign.id     | fee             | null           |

### 4.11 Contribution

```prisma
model Contribution {
  id             String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id    String             @db.Uuid
  contributor_id String             @db.Uuid
  amount_usd     Decimal            @db.Decimal(10, 2)
  currency       Currency
  status         ContributionStatus @default(completed)
  contributed_at DateTime           @default(now()) @db.Timestamptz
  refunded_at    DateTime?          @db.Timestamptz

  @@index([campaign_id])
  @@index([contributor_id])
  @@index([status])
  @@map("contribution")
}

enum ContributionStatus { completed refunded }
```

### 4.12 Sample

```prisma
model Sample {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id          String   @db.Uuid
  vendor_name          String   @db.VarChar(200)
  purchase_date        DateTime @db.Date
  physical_description String   @db.Text
  sample_label         String   @db.VarChar(200)
  target_lab_id        String   @db.Uuid
  order_index          Int      @default(0)
  created_at           DateTime @default(now()) @db.Timestamptz

  @@index([campaign_id])
  @@map("sample")
}
```

### 4.13 SampleClaim

```prisma
model SampleClaim {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sample_id         String    @db.Uuid
  claim_type        ClaimKind
  mass_amount       Decimal?  @db.Decimal(10, 4)
  mass_unit         String?   @db.VarChar(20)
  other_description String?   @db.Text

  @@map("sample_claim")
}

enum ClaimKind { mass other }
```

Validation rule (enforced in service, not DB):

- `claim_type = mass` → `mass_amount` and `mass_unit` must be non-null; `other_description` must be null.
- `claim_type = other` → `other_description` must be non-null; `mass_amount` and `mass_unit` must be null.
- `mass_unit` must be in the `valid_mass_units` configuration list.

### 4.14 TestRequest

```prisma
model TestRequest {
  id        String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sample_id String @db.Uuid
  test_id   String @db.Uuid

  @@unique([sample_id, test_id])
  @@map("test_request")
}
```

### 4.15 COA

One per sample. `file_url` stores the S3 **object key**, not a public URL.
Pre-signed URLs are generated at read time.

```prisma
model Coa {
  id                  String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sample_id           String             @unique @db.Uuid
  campaign_id         String             @db.Uuid
  s3_key               String             @db.Text          -- e.g. coas/{campaign_id}/{sample_id}/{ts}.pdf
  file_name           String             @db.VarChar(255)
  file_size_bytes     Int
  uploaded_by_user_id String             @db.Uuid
  uploaded_at         DateTime           @default(now()) @db.Timestamptz
  ocr_text            String?            @db.Text
  verification_status VerificationStatus @default(pending)
  verified_by_user_id String?            @db.Uuid
  verified_at         DateTime?          @db.Timestamptz
  verification_notes  String?            @db.Text

  @@index([campaign_id])
  @@index([verification_status])
  @@map("coa")
}

enum VerificationStatus { pending code_found code_not_found manually_approved rejected }
```

**Verified COA:** `verification_status IN ('code_found', 'manually_approved')`.
**Rejected COA:** `verification_status = 'rejected'`.

### 4.16 Lab

```prisma
model Lab {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                String    @unique @db.VarChar(200)
  phone_number        String?   @db.VarChar(50)
  country             String    @db.VarChar(100)
  address             String?   @db.Text
  is_approved         Boolean   @default(false)
  approved_by_user_id String?   @db.Uuid
  approved_at         DateTime? @db.Timestamptz
  created_at          DateTime  @default(now()) @db.Timestamptz
  updated_at          DateTime  @updatedAt @db.Timestamptz

  @@index([is_approved])
  @@map("lab")
}
```

### 4.17 Test (Catalog)

```prisma
model Test {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name               String   @unique @db.VarChar(200)
  description        String   @db.Text
  usp_code           String?  @db.VarChar(50)
  is_active          Boolean  @default(true)
  created_by_user_id String   @db.Uuid
  created_at         DateTime @default(now()) @db.Timestamptz

  @@index([is_active])
  @@map("test")
}
```

### 4.18 LabTest

```prisma
model LabTest {
  id                      String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  lab_id                  String   @db.Uuid
  test_id                 String   @db.Uuid
  price_usd               Decimal  @db.Decimal(10, 2)
  typical_turnaround_days Int
  created_at              DateTime @default(now()) @db.Timestamptz
  updated_at              DateTime @updatedAt @db.Timestamptz

  @@unique([lab_id, test_id])
  @@index([lab_id])
  @@index([test_id])
  @@map("lab_test")
}
```

### 4.19 LabTestPriceHistory

Written whenever `LabTest.price_usd` changes. The previous row's `effective_to`
is set to `now()` and a new row is inserted.

```prisma
model LabTestPriceHistory {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  lab_test_id        String    @db.Uuid
  price_usd          Decimal   @db.Decimal(10, 2)
  effective_from     DateTime  @default(now()) @db.Timestamptz
  effective_to       DateTime? @db.Timestamptz
  changed_by_user_id String    @db.Uuid
  change_reason      String?   @db.Text

  @@index([lab_test_id, effective_from])
  @@map("lab_test_price_history")
}
```

### 4.20 CampaignUpdate

```prisma
model CampaignUpdate {
  id                String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id       String     @db.Uuid
  author_id         String     @db.Uuid
  content           String     @db.Text
  update_type       UpdateType
  state_change_from String?    @db.VarChar(50)
  state_change_to   String?    @db.VarChar(50)
  created_at        DateTime   @default(now()) @db.Timestamptz

  @@index([campaign_id, created_at])
  @@map("campaign_update")
}

enum UpdateType { text state_change }
```

### 4.21 Reaction

```prisma
model Reaction {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  campaign_id   String       @db.Uuid
  user_id       String       @db.Uuid
  reaction_type ReactionType
  created_at    DateTime     @default(now()) @db.Timestamptz

  @@unique([campaign_id, user_id, reaction_type])
  @@index([campaign_id])
  @@map("reaction")
}

enum ReactionType { thumbs_up rocket praising_hands mad fire }
```

### 4.22 Notification

```prisma
model Notification {
  id                String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id           String           @db.Uuid
  notification_type NotificationType
  campaign_id       String           @db.Uuid
  title             String           @db.VarChar(255)
  message           String           @db.Text
  is_read           Boolean          @default(false)
  sent_email        Boolean          @default(false)
  created_at        DateTime         @default(now()) @db.Timestamptz
  read_at           DateTime?        @db.Timestamptz

  @@index([user_id, is_read])
  @@index([user_id, created_at])
  @@map("notification")
}

enum NotificationType {
  campaign_funded
  campaign_locked
  samples_shipped
  coa_uploaded
  campaign_resolved
  campaign_refunded
  deposit_confirmed
  withdrawal_sent
  withdrawal_failed
}
```

### 4.23 Configuration

```prisma
model Configuration {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  config_key         String   @unique @db.VarChar(100)
  config_value       Json
  description        String   @db.Text
  updated_at         DateTime @updatedAt @db.Timestamptz
  updated_by_user_id String?  @db.Uuid

  @@map("configuration")
}
```

**Seeded keys and defaults:**

| Key                       | Default Value                                                                                                        | Description                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `valid_mass_units`        | `{"units":["mg","g","kg","mcg","IU","ml","l","mcl"]}`                                                                | Allowed mass units for SampleClaims                  |
| `global_minimums`         | `{"min_contribution_usd":1,"min_funding_threshold_usd":10,"min_funding_threshold_percent":5,"min_withdrawal_usd":5}` | Platform-wide minimums                               |
| `platform_fee_percent`    | `{"value":5}`                                                                                                        | Fee % on resolution                                  |
| `max_campaign_multiplier` | `{"value":1.5}`                                                                                                      | Max requested / estimated lab cost ratio             |
| `auto_flag_threshold_usd` | `{"value":500}`                                                                                                      | Amount above which new campaigns are auto-flagged    |
| `max_withdrawal_per_day`  | `{"value":5}`                                                                                                        | Max withdrawal transactions per user per rolling 24h |
| `max_file_size_bytes`     | `{"value":10485760}`                                                                                                 | 10MB COA file size limit                             |

### 4.24 AuditLog

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String?  @db.Uuid
  action      String   @db.VarChar(100)
  entity_type String   @db.VarChar(50)
  entity_id   String   @db.Uuid
  changes     Json?
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now()) @db.Timestamptz

  @@index([entity_type, entity_id])
  @@index([user_id])
  @@index([created_at])
  @@map("audit_log")
}
```

Written by `AuditService.log()`. Called at the end of every state-mutating service
method. Does NOT use the same DB transaction as the business operation — audit failure
must never roll back a successful business transaction. Fire-and-forget, log on error.

---

## 5. Business Rules

### 5.1 Campaign Creation

- `amount_requested_usd` must be > 0 and ≤ `max_campaign_multiplier × estimated_lab_cost_usd`
- `funding_threshold_percent` must be between 5 and 100 inclusive
- `funding_threshold_usd = max(amount_requested_usd × threshold_pct / 100, min_funding_threshold_usd)`
- `estimated_lab_cost_usd = sum(lab_test.price_usd for all test_requests across all samples)` — computed and stored at creation
- `verification_code`: random integer 100000–999999, unique. Retry up to 10 times on collision; throw `InternalError` if all 10 collide.
- At least 1 sample required
- Each sample must have ≥ 1 `SampleClaim` and ≥ 1 `TestRequest`
- Each `TestRequest.test_id` must exist as a `LabTest` row for the sample's `target_lab_id`
- Each `target_lab` must have `is_approved = true`
- `platform_fee_percent` is snapshotted from config at creation (never re-read at resolution)
- Creator must have `campaign_creator` claim and `email_verified = true` and `is_banned = false`

**Auto-flag on creation** (`is_flagged_for_review = true`) if either:

- Creator has zero `resolved` campaigns, OR
- `amount_requested_usd > auto_flag_threshold_usd` config value

Auto-flagging does NOT block publication.

### 5.2 Contribution Rules

- Minimum: `min_contribution_usd` from config
- No maximum
- Accepted only when `campaign.status IN ('created', 'funded')`
- Contributor must have `contributor` claim, `email_verified = true`, `is_banned = false`
- Contributor must not be the campaign creator (creators cannot fund their own campaign)
- User must have sufficient balance in the specified currency
- Multiple contributions per user per campaign are allowed
- Contributions are visible to all authenticated users (contributor username + amount)

### 5.3 COA Verification

- PDF only. Validated by magic-byte check using `file-type` library (not HTTP `Content-Type`)
- File size ≤ `max_file_size_bytes` from config
- One COA per sample. Re-upload is permitted only if existing COA has `verification_status IN ('code_not_found', 'rejected')`. Blocked if `pending`, `code_found`, or `manually_approved`.
- All samples verified → campaign auto-advances to `results_published` and `resolveCampaign` is called immediately
- Any COA rejected → `is_flagged_for_review = true`, `status` stays `samples_sent`
- OCR: search the extracted text for the 6-digit verification code as a standalone integer string (use regex `\b{code}\b`)

### 5.4 Resolution Fee Formula

```
fee_usdc  = floor(escrow.balance_usdc × platform_fee_percent / 100 × 1_000_000) / 1_000_000
payout_usdc = escrow.balance_usdc − fee_usdc

fee_usdt  = floor(escrow.balance_usdt × platform_fee_percent / 100 × 1_000_000) / 1_000_000
payout_usdt = escrow.balance_usdt − fee_usdt
```

Use `Decimal.ROUND_DOWN` (floor). Escrow values are snapshotted at the start of
the SERIALIZABLE transaction — read them once, compute from those values.

### 5.5 Withdrawal Rules

- Minimum: `min_withdrawal_usd` from config
- Destination must be a valid base58 Solana public key — validate by attempting `new PublicKey(address)` and catching; also verify length is 32 bytes after decode
- Rolling 24-hour limit: count `LedgerTransaction` rows where `transaction_type = 'withdrawal'`, `from_account_id = user.id`, `status IN ('pending','confirmed')`, `created_at > now() - 24h`. If count ≥ `max_withdrawal_per_day`, throw `RateLimitError`.

### 5.6 Deposit Rules

- Any SPL transfer to a `DepositAddress` where mint = `USDC_MINT` or `USDT_MINT` is credited
- Amount = raw token amount ÷ 10^6 (both USDC and USDT use 6 decimals)
- Unknown mints: log as `warn` and skip; do not throw
- Minimum deposit: none (credit any positive amount)

---

## 6. Error Contracts

All errors respond with:

```json
{ "error": "ErrorClassName", "message": "Human-readable message", "details": {} }
```

| Class                      | HTTP | Use                                                           |
| -------------------------- | ---- | ------------------------------------------------------------- |
| `ValidationError`          | 400  | Invalid input, failed class-validator                         |
| `AuthenticationError`      | 401  | Missing/invalid/expired JWT or refresh token                  |
| `AuthorizationError`       | 403  | Valid JWT, insufficient claims, banned user, unverified email |
| `NotFoundError`            | 404  | Entity not found                                              |
| `ConflictError`            | 409  | Wrong state for operation                                     |
| `InsufficientBalanceError` | 422  | Balance < amount                                              |
| `RateLimitError`           | 429  | Withdrawal limit exceeded                                     |
| `InternalError`            | 500  | Unexpected errors                                             |

---

## 7. Core Flows

> Every flow section lists: guards, steps, ledger entries required, audit log entry required,
> and notifications to send. Implement all of them — none are optional.

### 7.1 User Registration

**Input:** `{ email, password, username? }`

**Validations (throw `ValidationError` on failure):**

- `email`: valid format (use class-validator `@IsEmail`), max 255 chars, not already in DB
- `password`: min 8 chars, ≥ 1 uppercase, ≥ 1 lowercase, ≥ 1 digit
- `username`: if provided — 3–50 chars, regex `^[a-zA-Z0-9_]+$`, not already in DB

**Steps (all in one DB transaction):**

1. Hash password: `bcrypt.hash(password, 12)`
2. Create `User` row with `email_verified = false`
3. Create `LedgerAccount` row (all balances = 0)
4. Generate Solana keypair; AES-256-GCM encrypt the private key using `ENCRYPTION_KEY`
5. Create `DepositAddress` row
6. Insert two `UserClaim` rows: `campaign_creator` and `contributor`
7. Generate email verification token (random 32-byte hex); store hashed in a `EmailVerificationToken` table (see 7.14)
8. Generate JWT access token (15 min) and refresh token (random 32-byte hex, 7-day expiry)
9. Hash the refresh token (SHA-256 hex); insert `RefreshToken` row
10. Enqueue email job: send verification email

**Audit:** `action: 'user.registered'`, `entity_type: 'user'`, `entity_id: user.id`

**Response:** `{ user: UserDto, accessToken, refreshToken, depositAddress: string }`

Note: `depositAddress` in the response is `deposit_address.public_key` (the Solana address string).
The encrypted private key is NEVER returned.

---

### 7.2 Login

**Input:** `{ email, password }`

**Steps:**

1. Find user by email; throw `AuthenticationError` if not found (do NOT reveal whether email exists — same error either way)
2. `bcrypt.compare(password, user.password_hash)`; throw `AuthenticationError` on mismatch
3. If `user.is_banned`, throw `AuthorizationError('Account suspended')`
4. Generate new access + refresh token pair
5. Insert `RefreshToken` row

**Audit:** `action: 'user.login'`, `entity_type: 'user'`, `entity_id: user.id`

**Response:** `{ user: UserDto, accessToken, refreshToken }`

---

### 7.3 Refresh Token

**Input:** `{ refreshToken: string }`

**Steps:**

1. Hash the incoming token (SHA-256); query `RefreshToken` by `token_hash`
2. If not found: throw `AuthenticationError`
3. If `used_at IS NOT NULL`: token was already rotated — possible replay attack.
   Immediately delete ALL `RefreshToken` rows for this `user_id`, then throw `AuthenticationError('Token reuse detected')`
4. If `expires_at < now()`: throw `AuthenticationError('Token expired')`
5. Load user; if `is_banned`, throw `AuthorizationError`
6. Mark current token: `UPDATE refresh_token SET used_at = now() WHERE id = ?`
7. Generate new access + refresh token pair
8. Insert new `RefreshToken` row

**Response:** `{ accessToken, refreshToken }`

---

### 7.4 Deposit Flow

**Deposit Scanner — Bull repeatable job, every 30 seconds, concurrency 1.**

```
1. Load ALL DepositAddress rows
2. For each deposit_address:
   a. Call getSignaturesForAddress(public_key, { limit: 10, commitment: 'confirmed' })
   b. Filter out signatures already in ProcessedDepositSignature
   c. For each unprocessed signature:
      i.   getParsedTransaction(signature, { commitment: 'confirmed' })
      ii.  Find inner SPL transfer instructions where:
             destination = deposit_address.public_key
             mint IN (env.USDC_MINT, env.USDT_MINT)
      iii. If none found or amount = 0: skip
      iv.  Decrypt deposit address private key using AES-256-GCM + ENCRYPTION_KEY
      v.   Execute on-chain SPL transfer: deposit_address → master_wallet
           (deposit keypair signs; master pays SOL fees via a fee-payer pattern)
      vi.  On sweep TX FAILURE: log error, do NOT insert ProcessedDepositSignature,
           do NOT credit ledger. Scanner will retry on next cycle.
      vii. On sweep TX SUCCESS:
           [DB SERIALIZABLE transaction]
             - INSERT ProcessedDepositSignature (on unique constraint violation: skip silently — already processed)
             - credit LedgerAccount.balance_{currency} += amount
             - update LedgerAccount.lifetime_deposited_{currency} += amount
             - INSERT LedgerTransaction {
                 type: deposit, currency, amount,
                 from_account_type: external, from_account_id: null,
                 to_account_type: user, to_account_id: user.id,
                 onchain_signature: sweep_tx_signature, status: completed
               }
             - NotificationService.send(user.id, 'deposit_confirmed', ...)
```

**Retry:** 3 attempts per individual deposit signature, exponential backoff (1s, 2s, 4s).
After 3 failures on a given signature: log as `error` with the signature, skip, continue to next.

**Audit:** `action: 'ledger.deposit'`, `entity_type: 'ledger_account'`, `entity_id: ledger_account.id`

---

### 7.5 Withdrawal

**Input:** `{ amount: Decimal, currency: 'usdc'|'usdt', destination_address: string }`

**Guards (throw appropriate error):**

- `destination_address`: valid Solana public key — `new PublicKey(address)` must not throw, decoded length must be 32 bytes
- `amount >= min_withdrawal_usd` (config) — `ValidationError`
- `LedgerAccount.balance_{currency} >= amount` — `InsufficientBalanceError`
- Rolling 24h withdrawal count < `max_withdrawal_per_day` (config) — `RateLimitError`
- `user.email_verified = true` — `AuthorizationError`
- `user.is_banned = false` — `AuthorizationError`

**Steps:**

```
[DB SERIALIZABLE transaction]
  1. Re-read LedgerAccount with SELECT FOR UPDATE (pessimistic lock)
  2. Debit LedgerAccount.balance_{currency} -= amount
  3. Update LedgerAccount.lifetime_withdrawn_{currency} += amount
  4. INSERT LedgerTransaction {
       type: withdrawal, status: pending, amount, currency,
       from_account_type: user, from_account_id: user.id,
       to_account_type: external, external_address: destination_address
     }
  5. Enqueue withdrawal job { ledger_transaction_id }
```

**Audit:** `action: 'ledger.withdrawal_requested'`, `entity_type: 'ledger_account'`

**Response:** `{ ledger_transaction_id, status: 'pending' }`

---

### 7.5.1 Withdrawal Worker

**Concurrency: 1. Timeout: 90s.**

```
1. Load LedgerTransaction by id WHERE status = 'pending'
2. If not found or status ≠ 'pending': log warn and exit (already processed)
3. Check chain first (idempotency):
   If ledger_transaction.onchain_signature IS NOT NULL:
     Confirm the tx landed on-chain; if confirmed → update status = 'confirmed', exit
4. Execute on-chain SPL transfer: master_wallet → external_address
5. On SUCCESS:
   UPDATE LedgerTransaction { status: confirmed, onchain_signature }
   NotificationService.send(user_id, 'withdrawal_sent', ...)
6. On FAILURE (after Bull retries exhausted):
   [DB SERIALIZABLE transaction]
     Credit LedgerAccount.balance_{currency} += amount (restore)
     Update LedgerAccount.lifetime_withdrawn_{currency} -= amount (undo)
     UPDATE LedgerTransaction { status: failed }
   NotificationService.send(user_id, 'withdrawal_failed', ...)
   log.error({ ledger_transaction_id }, 'Withdrawal failed — balance restored')
```

**On retry:** before re-submitting, call `getTransaction(onchain_signature)`. If found
and confirmed, do NOT re-submit — update status to `confirmed` and exit. This prevents
double-spend on network timeout.

---

### 7.6 Campaign Creation

**Input:** (see section 9.4 for full DTO)

**Guards:**

- `user.claims` includes `campaign_creator`
- `user.email_verified = true`
- `user.is_banned = false`

**Steps:**

1. Load and validate each `target_lab` — must exist and `is_approved = true`
2. Load each `LabTest` for every `(target_lab_id, test_id)` pair — must exist
3. Compute `estimated_lab_cost_usd = sum(labTest.price_usd for each test_request across all samples)`
4. Validate `amount_requested_usd <= max_campaign_multiplier × estimated_lab_cost_usd`
5. Validate each `mass_unit` against `valid_mass_units` config
6. Generate `verification_code` (retry loop, max 10)
7. Snapshot `platform_fee_percent` from config
8. Compute `funding_threshold_usd`
9. Compute `deadline_fundraising = now() + 14 days`
10. Determine `is_flagged_for_review` (see section 5.1)

```
[DB transaction]
  - INSERT Campaign (with all computed fields)
  - INSERT CampaignEscrow { balance_usdc: 0, balance_usdt: 0 }
  - For each sample: INSERT Sample, then INSERT SampleClaims, then INSERT TestRequests
```

**Audit:** `action: 'campaign.created'`, `entity_type: 'campaign'`, `entity_id: campaign.id`

**Response:** full `CampaignDetailDto`

---

### 7.7 Edit Campaign

**Guard:**

- Caller is `campaign.creator_id`
- `campaign.status = 'created'`

**Editable fields only:** `title`, `description`, `is_itemized`, `itemization_data`

Any other field in the request body is silently ignored (do not throw — just skip).

**Audit:** `action: 'campaign.updated'`, `changes: { before, after }` for changed fields only

---

### 7.8 Delete Campaign

**Guard:**

- Caller is `campaign.creator_id`
- `campaign.status = 'created'`
- `campaign.current_funding_usd = 0` (no contributions; check the DB value, not the request)

**Steps:**

```
[DB transaction]
  DELETE Campaign (samples, claims, test_requests cascade via ON DELETE CASCADE)
  DELETE CampaignEscrow
```

**Audit:** `action: 'campaign.deleted'`, `entity_type: 'campaign'`

---

### 7.9 Contribute

**Input:** `{ amount: Decimal, currency: 'usdc'|'usdt' }`

**Guards:**

- `user.claims` includes `contributor`
- `user.email_verified = true`
- `user.is_banned = false`
- `user.id ≠ campaign.creator_id` (cannot fund own campaign)
- `campaign.status IN ('created', 'funded')`
- `amount >= min_contribution_usd` (config)
- `LedgerAccount.balance_{currency} >= amount`

**Steps:**

```
[DB SERIALIZABLE transaction]
  1. Re-read LedgerAccount and CampaignEscrow with SELECT FOR UPDATE
  2. Debit  LedgerAccount.balance_{currency}   -= amount
  3. Credit CampaignEscrow.balance_{currency}  += amount
  4. Update Campaign.current_funding_usd        += amount
  5. INSERT Contribution { status: completed, amount_usd: amount, currency }
  6. INSERT LedgerTransaction {
       type: contribution, currency, amount,
       from_account_type: user,     from_account_id: user.id,
       to_account_type:   campaign, to_account_id:   campaign.id,
       reference_id: contribution.id, status: completed
     }

Post-transaction:
  IF campaign.current_funding_usd >= campaign.funding_threshold_usd
     AND campaign.funded_at IS NULL:
    [separate DB transaction]
      UPDATE Campaign {
        status: funded,
        funded_at: now(),
        deadline_ship_samples: now() + 7 days
      }
      INSERT CampaignUpdate { type: state_change, from: created, to: funded }
    NotificationService.send(creator_id, 'campaign_funded', ...)
    NotificationService.sendToAllContributors(campaign_id, 'campaign_funded', ...)
```

**Audit:** `action: 'contribution.created'`, `entity_type: 'contribution'`, `entity_id: contribution.id`

---

### 7.10 Lock Campaign Early

**Guards:**

- Caller has `campaign_creator` claim AND `user.id = campaign.creator_id`
- `campaign.status = 'created'` — throw `ConflictError` otherwise
- `campaign.current_funding_usd >= campaign.funding_threshold_usd` — throw `ConflictError` otherwise

**Steps:**

```
[DB transaction]
  UPDATE Campaign {
    status: funded,
    locked_at: now(),
    funded_at: coalesce(funded_at, now()),    -- only set if not already set
    deadline_ship_samples: coalesce(funded_at, now()) + 7 days  -- use the SAME funded_at value
  }
  INSERT CampaignUpdate { type: state_change, from: created, to: funded }
NotificationService.sendToAllContributors(campaign_id, 'campaign_locked', ...)
```

**Audit:** `action: 'campaign.locked'`, `entity_type: 'campaign'`

---

### 7.11 Ship Samples

**Guards:**

- `user.id = campaign.creator_id`
- `campaign.status = 'funded'` — throw `ConflictError` otherwise

**Steps:**

```
[DB transaction]
  UPDATE Campaign {
    status: samples_sent,
    samples_sent_at: now(),
    deadline_publish_results: now() + 21 days
  }
  INSERT CampaignUpdate { type: state_change, from: funded, to: samples_sent }
NotificationService.sendToAllContributors(campaign_id, 'samples_shipped', ...)
```

**Audit:** `action: 'campaign.samples_shipped'`, `entity_type: 'campaign'`

---

### 7.12 Upload COA

**Guards:**

- `user.id = campaign.creator_id`
- `campaign.status = 'samples_sent'` — `ConflictError`
- Sample with `sample_id` belongs to `campaign_id` — `NotFoundError` if not
- If existing COA for this sample exists:
  - `verification_status IN ('code_found', 'manually_approved')` → `ConflictError('Cannot replace a verified COA')`
  - `verification_status = 'pending'` → `ConflictError('OCR in progress — wait for verification before re-uploading')`
  - `verification_status IN ('code_not_found', 'rejected')` → re-upload is allowed, continue

**File validation:**

1. Check file size ≤ `max_file_size_bytes` (config) before reading content
2. Read first 8 bytes; use `file-type` to verify PDF magic bytes (`%PDF`). Throw `ValidationError` if not PDF.
   Do NOT trust the HTTP `Content-Type` header.

**Steps:**

1. If previous COA exists: delete previous S3 object at its `s3_key`
2. Upload new file to S3: key = `coas/{campaign_id}/{sample_id}/{Date.now()}.pdf`
3. `UPSERT` COA row `{ s3_key, file_name, file_size_bytes, uploaded_by_user_id, uploaded_at: now(), verification_status: pending, ocr_text: null, verified_by_user_id: null, verified_at: null }`
4. Enqueue OCR job `{ coa_id }`
5. Notify admin users (all users with `admin` or `lab_approver` claim): `'coa_uploaded'`

**Audit:** `action: 'coa.uploaded'`, `entity_type: 'coa'`, `entity_id: coa.id`

**Response:** `CoaDto` (with `file_url` as a pre-signed S3 URL, TTL 1 hour)

---

### 7.12.1 OCR Worker

**Concurrency: 5. Timeout: 60s. Retries: 2.**

```
1. Load COA by id; if not found or status ≠ 'pending': exit (already processed)
2. Download PDF from S3 using the coa.s3_key
3. Extract text using pdf-parse
4. Search extracted text for the campaign's verification_code using regex: /\b{code}\b/
5. If found:
     UPDATE COA { verification_status: code_found, ocr_text: extracted_text }
6. If not found:
     UPDATE COA { verification_status: code_not_found, ocr_text: extracted_text }

NOTE: OCR result alone does not advance the campaign state.
      Only admin/lab_approver verification (section 7.13) does that.
```

---

### 7.13 Verify COA (Admin / Lab Approver)

**Input:** `{ status: 'approved'|'rejected', notes?: string }`

**Guard:** caller has `admin` OR `lab_approver` claim

**Steps (approved):**

```
[DB transaction]
  UPDATE COA {
    verification_status: manually_approved,
    verified_by_user_id: caller.id,
    verified_at: now(),
    verification_notes: notes ?? null
  }

  Check: SELECT COUNT(*) FROM sample WHERE campaign_id = ?
  vs     SELECT COUNT(*) FROM coa WHERE campaign_id = ?
           AND verification_status IN ('code_found','manually_approved')

  If counts match (all samples have a verified COA):
    UPDATE Campaign { status: results_published, results_published_at: now() }
    INSERT CampaignUpdate { type: state_change, from: samples_sent, to: results_published }
    → call resolveCampaign(campaign_id) [section 7.14] immediately within this flow
```

**Audit:** `action: 'coa.verified'`, `entity_type: 'coa'`

**Steps (rejected):**

```
[DB transaction]
  UPDATE COA {
    verification_status: rejected,
    verified_by_user_id: caller.id,
    verified_at: now(),
    verification_notes: notes ?? null
  }
  UPDATE Campaign {
    is_flagged_for_review: true,
    flagged_reason: 'COA rejected: ' + (notes ?? 'no reason given')
  }
NotificationService.send(campaign.creator_id, 'coa_uploaded', message: 'Your COA was rejected: {notes}')
```

**Audit:** `action: 'coa.rejected'`, `entity_type: 'coa'`

---

### 7.14 Resolve Campaign

**Guard:** `campaign.status = 'results_published'` — `ConflictError` otherwise

**Steps:**

```
[DB SERIALIZABLE transaction]
  1. Re-read CampaignEscrow WITH SELECT FOR UPDATE
  2. Snapshot: escrow_usdc = escrow.balance_usdc, escrow_usdt = escrow.balance_usdt

  Compute USDC:
    fee_usdc    = floor(escrow_usdc × platform_fee_percent / 100 × 1_000_000) / 1_000_000
    payout_usdc = escrow_usdc − fee_usdc

  Compute USDT (same formula):
    fee_usdt    = floor(escrow_usdt × platform_fee_percent / 100 × 1_000_000) / 1_000_000
    payout_usdt = escrow_usdt − fee_usdt

  If payout_usdc > 0:
    Credit creator LedgerAccount.balance_usdc  += payout_usdc
    Debit  CampaignEscrow.balance_usdc         -= escrow_usdc  (zeroes it)
    Credit FeeAccount.balance_usdc             += fee_usdc
    INSERT LedgerTransaction { type: payout, amount: payout_usdc, currency: usdc,
      from_account_type: campaign, from_account_id: campaign.id,
      to_account_type: user, to_account_id: campaign.creator_id }
    INSERT LedgerTransaction { type: fee, amount: fee_usdc, currency: usdc,
      from_account_type: campaign, from_account_id: campaign.id,
      to_account_type: fee, to_account_id: null }

  If payout_usdt > 0: [same pattern]

  UPDATE Campaign { status: resolved, resolved_at: now() }
  INSERT CampaignUpdate { type: state_change, from: results_published, to: resolved }

NotificationService.send(creator_id, 'campaign_resolved', 'Campaign resolved — funds in your balance')
NotificationService.sendToAllContributors(campaign_id, 'campaign_resolved', 'Campaign completed successfully')
```

**Audit:** `action: 'campaign.resolved'`, `entity_type: 'campaign'`

---

### 7.15 Refund Contributions

**Guard:** `campaign.status NOT IN ('resolved','refunded')` — `ConflictError` otherwise

**Input:** `reason: string`

**Steps:**

```
[DB SERIALIZABLE transaction]
  prev_status = campaign.status

  Load all Contributions WHERE campaign_id = ? AND status = 'completed'

  For each contribution:
    Credit contributor LedgerAccount.balance_{currency} += contribution.amount_usd
    UPDATE Contribution { status: refunded, refunded_at: now() }
    INSERT LedgerTransaction {
      type: refund, amount: contribution.amount_usd, currency: contribution.currency,
      from_account_type: campaign, from_account_id: campaign.id,
      to_account_type: user, to_account_id: contribution.contributor_id,
      reference_id: contribution.id, status: completed
    }

  UPDATE CampaignEscrow { balance_usdc: 0, balance_usdt: 0 }
  UPDATE Campaign {
    status: refunded,
    refunded_at: now(),
    refund_reason: reason,
    current_funding_usd: 0
  }
  INSERT CampaignUpdate { type: state_change, from: prev_status, to: refunded }

For each contributor (distinct): NotificationService.send(contributor_id, 'campaign_refunded', ...)
```

**Audit:** `action: 'campaign.refunded'`, `entity_type: 'campaign'`

---

### 7.16 Email Verification

**Step 1 — Verify email:**

Store verification tokens in:

```prisma
model EmailVerificationToken {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  token_hash String   @unique @db.VarChar(64)  -- SHA-256 hex of raw token
  expires_at DateTime @db.Timestamptz          -- now() + 24 hours
  used_at    DateTime? @db.Timestamptz
  created_at DateTime  @default(now()) @db.Timestamptz

  @@index([user_id])
  @@map("email_verification_token")
}
```

**`POST /auth/verify-email` — Input:** `{ token: string }`

1. Hash incoming token; find `EmailVerificationToken` by `token_hash`
2. If not found or `expires_at < now()` or `used_at IS NOT NULL`: throw `ValidationError('Invalid or expired token')`
3. `UPDATE User { email_verified: true }`
4. `UPDATE EmailVerificationToken { used_at: now() }`

**`POST /auth/resend-verification` — Input:** none (JWT required)

1. If user already verified: throw `ConflictError`
2. Invalidate existing unused verification tokens for this user
3. Generate new token, insert new row, enqueue email

**Audit:** `action: 'user.email_verified'`, `entity_type: 'user'`

---

### 7.17 Fee Sweep (Admin)

**Input:** `{ destination_address: string, currency: 'usdc'|'usdt' }`

**Guard:** caller has `admin` claim

**Steps:**

```
[DB SERIALIZABLE transaction]
  balance = FeeAccount.balance_{currency}
  If balance = 0: return { message: 'Nothing to sweep' }

  UPDATE FeeAccount { balance_{currency}: 0 }
  INSERT LedgerTransaction {
    type: withdrawal, status: pending, amount: balance, currency,
    from_account_type: fee, from_account_id: null,
    to_account_type: external, external_address: destination_address
  }
  Enqueue withdrawal job { ledger_transaction_id }
```

**Audit:** `action: 'fee.swept'`, `entity_type: 'fee_account'`

---

### 7.18 Deadline Monitor Job

**Bull repeatable job, every 5 minutes, concurrency 1.**

```
Before processing any expired campaign, check:
  IF any Coa WHERE campaign_id = ? AND verification_status = 'pending' exists:
    SKIP this campaign — OCR is in progress; retry on next cycle

Queries:
  SELECT * FROM campaign WHERE status = 'created'      AND deadline_fundraising     < now()
  SELECT * FROM campaign WHERE status = 'funded'       AND deadline_ship_samples    < now()
  SELECT * FROM campaign WHERE status = 'samples_sent' AND deadline_publish_results < now()

For each expired campaign:
  Try: refundContributions(campaign.id, '{status} deadline expired')
  Catch: log error, continue to next campaign (never block the batch)
```

Each campaign's refund is independent. Failure of one does not affect others.

---

## 8. Money Flow Diagram

```
External Wallet
      │
      │ User sends USDC/USDT on-chain to their DepositAddress
      ▼
DepositAddress (ephemeral, per-user, keypair stored encrypted in DB)
      │
      │ Scanner sweeps on-chain (deposit keypair signs)
      ▼
Master Wallet  (single Solana address — holds ALL user funds)
      │
      │  Everything below this line is DB-only. No on-chain transactions.
      ▼
┌──────────────────┬──────────────────┬───────────────┐
│  LedgerAccount   │  CampaignEscrow  │  FeeAccount   │
│   (per user)     │  (per campaign)  │  (platform)   │
└────────┬─────────┴────────┬─────────┴───────┬───────┘
         │  contribute      │                 │
         ├─────────────────►│                 │
         │  refund          │                 │
         │◄─────────────────┤                 │
         │  payout (net)    │  fee            │
         │◄─────────────────┼────────────────►│
         │                  │                 │
         │ (user withdrawal)                  │ (admin fee-sweep)
         ▼                                    ▼
   Master Wallet ──── on-chain SPL ────► External Wallet
```

---

## 9. API Specification

All routes return `application/json`.
Auth: `Authorization: Bearer <JWT>` unless stated otherwise.
Pagination: `?page=1&limit=20` (default `limit=20`, max `limit=100`).
Paginated responses: `{ data: T[], total: number, page: number, limit: number }`.

Rate limiting (Express middleware, applied globally):

- All routes: 100 req/min per IP
- `/auth/*` routes: 10 req/min per IP
- `/campaigns/verification-code`: 5 req/min per authenticated user

### 9.1 Authentication

| Method | Path                        | Auth | Body                           | Response                                                     |
| ------ | --------------------------- | ---- | ------------------------------ | ------------------------------------------------------------ |
| POST   | `/auth/register`            | None | `{email, password, username?}` | `{user: UserDto, accessToken, refreshToken, depositAddress}` |
| POST   | `/auth/login`               | None | `{email, password}`            | `{user: UserDto, accessToken, refreshToken}`                 |
| POST   | `/auth/refresh`             | None | `{refreshToken}`               | `{accessToken, refreshToken}`                                |
| POST   | `/auth/logout`              | JWT  | —                              | `204`                                                        |
| GET    | `/auth/me`                  | JWT  | —                              | `UserDto`                                                    |
| POST   | `/auth/verify-email`        | None | `{token}`                      | `{message}`                                                  |
| POST   | `/auth/resend-verification` | JWT  | —                              | `{message}`                                                  |

`POST /auth/logout`: deletes the current user's active refresh tokens (all sessions).
The access token is short-lived (15 min) and is not invalidated server-side — clients
should discard it locally.

### 9.2 Wallet

| Method | Path                      | Auth | Body/Query                                | Response                                     |
| ------ | ------------------------- | ---- | ----------------------------------------- | -------------------------------------------- |
| GET    | `/wallet/balance`         | JWT  | —                                         | `{balance_usdc, balance_usdt}`               |
| GET    | `/wallet/deposit-address` | JWT  | —                                         | `{address: string, qr_hint: string}`         |
| POST   | `/wallet/withdraw`        | JWT  | `{amount, currency, destination_address}` | `{ledger_transaction_id, status: 'pending'}` |
| GET    | `/wallet/transactions`    | JWT  | `?page&limit&type`                        | Paginated `LedgerTransactionDto[]`           |

`qr_hint` = a `solana:` URI string for QR code generation (`solana:{address}`).

### 9.3 Campaigns — Public

| Method | Path                           | Auth         | Query                            | Response                        |
| ------ | ------------------------------ | ------------ | -------------------------------- | ------------------------------- |
| GET    | `/campaigns`                   | None         | `?status&search&sort&page&limit` | Paginated `CampaignListDto[]`   |
| GET    | `/campaigns/:id`               | Optional JWT | —                                | `CampaignDetailDto`             |
| GET    | `/campaigns/:id/coas`          | None         | —                                | `CoaDto[]`                      |
| GET    | `/campaigns/:id/contributions` | JWT          | `?page&limit`                    | Paginated `ContributionDto[]`   |
| GET    | `/campaigns/:id/reactions`     | None         | —                                | `ReactionCountsDto`             |
| GET    | `/campaigns/:id/updates`       | None         | `?page&limit`                    | Paginated `CampaignUpdateDto[]` |

**Sort values for `GET /campaigns`:** `newest` (default), `oldest`, `progress_desc`, `progress_asc`, `deadline_asc`

**Status filter values:** `created`, `funded`, `samples_sent`, `results_published`, `resolved`, `refunded`, `active` (= `created` + `funded` + `samples_sent`)

**`CampaignDetailDto.my_reaction`:** the authenticated user's reaction type string, or `null` if unauthenticated or no reaction.

### 9.4 Campaigns — Creator

| Method | Path                                   | Auth                      | Body                        | Response                      |
| ------ | -------------------------------------- | ------------------------- | --------------------------- | ----------------------------- |
| POST   | `/campaigns`                           | JWT (campaign_creator)    | `CreateCampaignDto`         | `CampaignDetailDto`           |
| GET    | `/campaigns/me`                        | JWT                       | `?page&limit&status`        | Paginated `CampaignListDto[]` |
| PATCH  | `/campaigns/:id`                       | JWT (own, status=created) | `UpdateCampaignDto`         | `CampaignDetailDto`           |
| DELETE | `/campaigns/:id`                       | JWT (own)                 | —                           | `204`                         |
| POST   | `/campaigns/:id/lock`                  | JWT (own)                 | —                           | `CampaignDetailDto`           |
| POST   | `/campaigns/:id/ship-samples`          | JWT (own)                 | —                           | `CampaignDetailDto`           |
| POST   | `/campaigns/:id/updates`               | JWT (own)                 | `{content: string}`         | `CampaignUpdateDto`           |
| POST   | `/campaigns/:id/samples/:sampleId/coa` | JWT (own)                 | `multipart/form-data: file` | `CoaDto`                      |

`UpdateCampaignDto` fields: `title?`, `description?`, `is_itemized?`, `itemization_data?`

### 9.5 Contributions

| Method | Path                        | Auth              | Body/Query           | Response                      |
| ------ | --------------------------- | ----------------- | -------------------- | ----------------------------- |
| POST   | `/campaigns/:id/contribute` | JWT (contributor) | `{amount, currency}` | `ContributionDto`             |
| GET    | `/users/me/contributions`   | JWT               | `?page&limit&status` | Paginated `ContributionDto[]` |

### 9.6 Reactions

| Method | Path                             | Auth | Body              | Response                      |
| ------ | -------------------------------- | ---- | ----------------- | ----------------------------- |
| POST   | `/campaigns/:id/reactions`       | JWT  | `{reaction_type}` | `{reaction_type, created_at}` |
| DELETE | `/campaigns/:id/reactions/:type` | JWT  | —                 | `204`                         |

`POST` on an existing reaction for the same `(campaign_id, user_id, reaction_type)` is idempotent (upsert).

### 9.7 Users

| Method | Path                                 | Auth | Body                         | Response               |
| ------ | ------------------------------------ | ---- | ---------------------------- | ---------------------- |
| GET    | `/users/me`                          | JWT  | —                            | `UserDto`              |
| PATCH  | `/users/me`                          | JWT  | `{username?}`                | `UserDto`              |
| PATCH  | `/users/me/notification-preferences` | JWT  | `NotificationPreferencesDto` | `UserDto`              |
| GET    | `/users/:id/profile`                 | None | —                            | `PublicUserProfileDto` |

### 9.8 Notifications

| Method | Path                          | Auth | Response                                     |
| ------ | ----------------------------- | ---- | -------------------------------------------- |
| GET    | `/notifications`              | JWT  | Paginated `NotificationDto[]` (unread first) |
| GET    | `/notifications/unread-count` | JWT  | `{count: number}`                            |
| PATCH  | `/notifications/:id/read`     | JWT  | `NotificationDto`                            |
| PATCH  | `/notifications/read-all`     | JWT  | `{marked_count: number}`                     |

### 9.9 Labs

| Method | Path                      | Auth               | Body                                            | Response             |
| ------ | ------------------------- | ------------------ | ----------------------------------------------- | -------------------- |
| GET    | `/labs`                   | None               | `?approved_only=true&page&limit`                | Paginated `LabDto[]` |
| GET    | `/labs/:id`               | None               | —                                               | `LabDetailDto`       |
| POST   | `/labs`                   | JWT (lab_approver) | `{name, phone_number?, country, address?}`      | `LabDto`             |
| PATCH  | `/labs/:id`               | JWT (lab_approver) | Partial lab fields                              | `LabDto`             |
| POST   | `/labs/:id/approve`       | JWT (lab_approver) | —                                               | `LabDto`             |
| POST   | `/labs/:id/tests`         | JWT (lab_approver) | `{test_id, price_usd, typical_turnaround_days}` | `LabTestDto`         |
| PATCH  | `/labs/:id/tests/:testId` | JWT (lab_approver) | `{price_usd?, typical_turnaround_days?}`        | `LabTestDto`         |

When `price_usd` is updated via `PATCH /labs/:id/tests/:testId`:

1. Set the current `LabTestPriceHistory` row's `effective_to = now()`
2. Insert a new `LabTestPriceHistory` row with `effective_from = now()`
3. Update `LabTest.price_usd`

### 9.10 Tests

| Method | Path         | Auth        | Body                                | Response    |
| ------ | ------------ | ----------- | ----------------------------------- | ----------- |
| GET    | `/tests`     | None        | `?active_only=true`                 | `TestDto[]` |
| POST   | `/tests`     | JWT (admin) | `{name, description, usp_code?}`    | `TestDto`   |
| PATCH  | `/tests/:id` | JWT (admin) | `{is_active?, name?, description?}` | `TestDto`   |

### 9.11 Leaderboards

| Method | Path                        | Auth | Query                        | Response                |
| ------ | --------------------------- | ---- | ---------------------------- | ----------------------- |
| GET    | `/leaderboard/contributors` | None | `?period=all\|monthly&limit` | `LeaderboardEntryDto[]` |
| GET    | `/leaderboard/creators`     | None | `?period=all\|monthly&limit` | `LeaderboardEntryDto[]` |

- **Contributors:** ranked by `SUM(amount_usd)` across `Contribution` rows with `status = 'completed'` linked to non-refunded campaigns. Exclude banned users. `monthly` = current calendar month UTC.
- **Creators:** ranked by `COUNT(*)` of campaigns where `status = 'resolved'`. Exclude banned users.
- Default `limit = 10`. Max `limit = 100`.

### 9.12 Admin

| Method | Path                          | Auth                      | Body                                               | Response                        |
| ------ | ----------------------------- | ------------------------- | -------------------------------------------------- | ------------------------------- |
| GET    | `/admin/campaigns`            | JWT (admin)               | `?status&flagged&page&limit`                       | Paginated `CampaignDetailDto[]` |
| POST   | `/admin/campaigns/:id/refund` | JWT (admin)               | `{reason: string}`                                 | `CampaignDetailDto`             |
| POST   | `/admin/campaigns/:id/hide`   | JWT (admin)               | `{hidden: boolean}`                                | `CampaignDetailDto`             |
| POST   | `/admin/coas/:id/verify`      | JWT (admin\|lab_approver) | `{status: 'approved'\|'rejected', notes?: string}` | `CoaDto`                        |
| POST   | `/admin/users/:id/ban`        | JWT (admin)               | `{banned: boolean, reason?: string}`               | `UserDto`                       |
| POST   | `/admin/users/:id/claims`     | JWT (admin)               | `{claim_type, action: 'grant'\|'revoke'}`          | `UserDto`                       |
| GET    | `/admin/config`               | JWT (admin)               | —                                                  | `ConfigurationDto[]`            |
| PUT    | `/admin/config/:key`          | JWT (admin)               | `{value: any}`                                     | `ConfigurationDto`              |
| POST   | `/admin/fee-sweep`            | JWT (admin)               | `{destination_address, currency}`                  | `{ledger_transaction_id}`       |

`POST /admin/campaigns/:id/hide` adds an `is_hidden` boolean column to `campaign`. Hidden campaigns
do not appear in `GET /campaigns` for unauthenticated users or non-admins. Add `is_hidden Boolean @default(false)` to the Campaign model.

`POST /admin/users/:id/ban` with `banned: true`:

1. Update `User.is_banned = true`
2. Delete all `RefreshToken` rows for the user (revoke sessions immediately)

### 9.13 Utility

| Method | Path                           | Auth | Query             | Response                                            |
| ------ | ------------------------------ | ---- | ----------------- | --------------------------------------------------- |
| GET    | `/campaigns/estimate-cost`     | JWT  | `?samples=<JSON>` | `{estimated_usd, breakdown: LabCostBreakdownDto[]}` |
| GET    | `/campaigns/verification-code` | JWT  | —                 | `{code: number}`                                    |
| GET    | `/app-info`                    | None | —                 | `AppInfoDto`                                        |

`/campaigns/verification-code` generates a preview code but does NOT reserve it.
It is subject to a 5 req/min rate limit per user. The code generated here is for
display/preview only — the real code is generated at campaign creation.

`AppInfoDto`: `{ version, network, usdc_mint, usdt_mint, minimums: GlobalMinimumsConfig }`

---

## 10. Background Jobs

### 10.1 Deposit Scanner

- **Frequency:** 30 seconds
- **Concurrency:** 1
- **Retries per signature:** 3, backoff 1s/2s/4s
- See section 7.4

### 10.2 Deadline Monitor

- **Frequency:** 5 minutes
- **Concurrency:** 1
- **Pending COA check:** skip campaign if any COA has `verification_status = 'pending'`
- See section 7.18

### 10.3 OCR Processor

- **Type:** On-demand (enqueued after COA upload)
- **Concurrency:** 5
- **Timeout:** 60s
- **Retries:** 2
- See section 7.12.1

### 10.4 Email Sender

- **Type:** On-demand
- **Concurrency:** 10
- **Retries:** 0 (informational; duplicates tolerable)
- On failure: log `warn`, do not retry

### 10.5 Withdrawal Processor

- **Type:** On-demand (enqueued after withdrawal request)
- **Concurrency:** 1
- **Timeout:** 90s
- **Retries:** 2; on final failure restore balance
- See section 7.5.1

### 10.6 Reconciliation Job

- **Frequency:** 1 hour
- **Action:** Sum `ledger_account.balance_usdc` + `campaign_escrow.balance_usdc` + `fee_account.balance_usdc`; compare to on-chain master wallet USDC token balance. Repeat for USDT.
- **On discrepancy:** `log.error` with both values + delta; send operator alert email. **Never auto-correct.**

### 10.7 Refresh Token Cleanup

- **Frequency:** daily
- **Action:** `DELETE FROM refresh_token WHERE expires_at < now() - interval '7 days'`

---

## 11. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/peptest

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<min 32 char random string>
JWT_REFRESH_SECRET=<not used for signing — tokens are random; kept for legacy>

# Solana
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
USDC_MINT=<SPL token mint address>
USDT_MINT=<SPL token mint address>
MASTER_WALLET_PUBLIC_KEY=<base58>
MASTER_WALLET_PRIVATE_KEY=<base58 — NEVER commit; workers only>

# Encryption (deposit address private keys)
ENCRYPTION_KEY=<64-char hex string = 32 bytes>
ENCRYPTION_IV_LENGTH=12

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=peptest-coas
AWS_S3_ENDPOINT=<optional — for MinIO>
S3_SIGNED_URL_TTL_SECONDS=3600

# Email (SMTP via Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@peptest.com
OPERATOR_ALERT_EMAIL=ops@peptest.com

# App
PORT=3000
NODE_ENV=development
APP_URL=https://peptest.com
APP_VERSION=1.0.0

# Test only
TEST_MASTER_WALLET_PUBKEY=<devnet>
TEST_MASTER_WALLET_KEY=<devnet private key — never mainnet>
```

All vars are declared and validated in `packages/bff/src/config/env.config.ts` using `envalid`.
Direct `process.env.*` access anywhere else is forbidden (see coding rules).

---

## 12. DTO Shapes

### UserDto

```typescript
{
  id: string;
  email: string;
  username: string | null;
  is_banned: boolean;
  email_verified: boolean;
  claims: ClaimType[];
  stats: {
    total_contributed_usd: number;
    campaigns_created: number;
    campaigns_successful: number;
    campaigns_refunded: number;
  };
  created_at: string; // ISO 8601
}
```

### CampaignListDto

```typescript
{
  id: string;
  title: string;
  status: CampaignStatus;
  creator: { id: string; username: string | null };
  amount_requested_usd: number;
  current_funding_usd: number;
  funding_threshold_usd: number;
  funding_progress_percent: number;        // current / threshold × 100
  is_flagged_for_review: boolean;
  is_hidden: boolean;
  sample_labels: string[];
  deadline_fundraising: string | null;
  time_remaining_seconds: number | null;   // null if no active deadline
  created_at: string;
}
```

### CampaignDetailDto

```typescript
{
  id: string;
  title: string;
  description: string;
  status: CampaignStatus;
  creator: { id: string; username: string | null; successful_campaigns: number };
  verification_code: number;
  amount_requested_usd: number;
  estimated_lab_cost_usd: number;
  current_funding_usd: number;
  funding_threshold_usd: number;
  funding_threshold_percent: number;
  funding_progress_percent: number;
  platform_fee_percent: number;
  is_flagged_for_review: boolean;
  flagged_reason: string | null;
  is_itemized: boolean;
  itemization_data: unknown | null;
  samples: SampleDto[];
  updates: CampaignUpdateDto[];
  reactions: ReactionCountsDto;
  my_reaction: ReactionType | null;         // null if unauthenticated
  deadlines: {
    fundraising: string | null;
    ship_samples: string | null;
    publish_results: string | null;
  };
  timestamps: {
    created_at: string;
    funded_at: string | null;
    locked_at: string | null;
    samples_sent_at: string | null;
    results_published_at: string | null;
    resolved_at: string | null;
    refunded_at: string | null;
  };
  refund_reason: string | null;
}
```

### SampleDto

```typescript
{
  id: string;
  vendor_name: string;
  purchase_date: string;         // ISO date (YYYY-MM-DD)
  physical_description: string;
  sample_label: string;
  order_index: number;
  target_lab: { id: string; name: string };
  claims: SampleClaimDto[];
  tests: TestInfoDto[];
  coa: CoaDto | null;
}
```

### CoaDto

```typescript
{
  id: string;
  sample_id: string;
  file_url: string; // pre-signed S3 URL, TTL from S3_SIGNED_URL_TTL_SECONDS
  file_name: string;
  file_size_bytes: number;
  uploaded_at: string;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
}
```

### ContributionDto

```typescript
{
  id: string;
  campaign_id: string;
  campaign_title: string;
  contributor: {
    id: string;
    username: string | null;
  }
  amount_usd: number;
  currency: Currency;
  status: ContributionStatus;
  contributed_at: string;
  refunded_at: string | null;
}
```

### LedgerTransactionDto

```typescript
{
  id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: Currency;
  from_account_type: AccountType;
  to_account_type: AccountType;
  status: TxStatus;
  onchain_signature: string | null;
  created_at: string;
}
```

### ReactionCountsDto

```typescript
{
  thumbs_up: number;
  rocket: number;
  praising_hands: number;
  mad: number;
  fire: number;
}
```

### LeaderboardEntryDto

```typescript
{
  rank: number;
  user: {
    id: string;
    username: string | null;
  }
  value: number; // total_usd for contributors; resolved_count for creators
  period: 'all' | 'monthly';
}
```

### PublicUserProfileDto

```typescript
{
  id: string;
  username: string | null;
  stats: {
    total_contributed_usd: number;
    campaigns_created: number;
    campaigns_successful: number;
  }
  created_at: string;
}
```

---

## 13. Integration Test Scenarios

Each scenario runs in a fully isolated DB (truncate all tables in `beforeEach`).
On-chain tests use Solana devnet. Use a test helper `creditLedger(userId, amount, currency)`
that directly updates `LedgerAccount` to simulate deposits — bypassing the scanner —
in scenarios that do not test the deposit flow.

Test file naming: `tests/integration/scenario-{nn}-{slug}.test.ts`

### Scenario 01 — Happy Path: Full Lifecycle

1. Register creator + 3 contributors; `creditLedger` each contributor $5 USDC
2. Creator creates campaign: $6 target, 60% threshold ($3.60 min), 1 sample, 1 test
3. Contributor A contributes $1, B contributes $1, C contributes $1 (total $3 — below threshold)
4. Contributor A contributes $1 again (total $4 > $3.60 threshold)
5. Assert: `campaign.status = 'funded'`, `deadline_ship_samples` is set, `funded_at` is set
6. Creator calls `ship-samples` → `status = 'samples_sent'`
7. Creator uploads COA (PDF containing the verification code)
8. Run OCR worker → `verification_status = 'code_found'`
9. Admin calls `verify COA` with `status = 'approved'`
10. Assert: `campaign.status = 'resolved'`
11. Assert: `creator.ledger_account.balance_usdc = 4 × 0.95 = 3.80` (5% fee)
12. Assert: `fee_account.balance_usdc = 4 × 0.05 = 0.20`
13. Assert: `campaign_escrow.balance_usdc = 0`
14. Assert: `LedgerTransaction` rows: 4 × `contribution`, 1 × `payout`, 1 × `fee`
15. Creator withdraws $2 to a devnet address
16. Run withdrawal worker
17. Assert: on-chain USDC transfer occurred
18. Assert: `creator.ledger_account.balance_usdc = 1.80`

### Scenario 02 — Refund: Fundraising Deadline Expired

1. `creditLedger` contributor $5; create campaign ($10 target, 100% threshold = $10)
2. Contribute $3 (below threshold)
3. Directly update `campaign.deadline_fundraising = 1 hour ago` in DB
4. Run deadline monitor job
5. Assert: `campaign.status = 'refunded'`, `contribution.status = 'refunded'`
6. Assert: `contributor.balance_usdc = 5.00` (fully restored)
7. Assert: `campaign_escrow.balance_usdc = 0`, `LedgerTransaction` 1 contribution + 1 refund

### Scenario 03 — Refund: Ship Deadline Expired

1. Fund campaign to threshold → `status = 'funded'`
2. Set `deadline_ship_samples = 1 hour ago`
3. Run deadline monitor → Assert: `status = 'refunded'`, contributions refunded

### Scenario 04 — Refund: Results Deadline Expired

1. Fund + ship campaign → `status = 'samples_sent'`
2. Set `deadline_publish_results = 1 hour ago`
3. Run deadline monitor → Assert: `status = 'refunded'`

### Scenario 05 — Deadline Monitor Skips Campaign With Pending COA

1. Fund + ship campaign → `status = 'samples_sent'`
2. Set `deadline_publish_results = 1 hour ago`
3. Upload COA → `verification_status = 'pending'` (OCR not yet run)
4. Run deadline monitor
5. Assert: `campaign.status` STILL `'samples_sent'` (not refunded — OCR is pending)

### Scenario 06 — Early Lock

1. Create campaign ($10 target, 50% threshold = $5 min)
2. Contribute $7 (crosses $5 threshold) → `status = 'funded'`, `funded_at` set
3. Creator calls `lock` → Assert: `locked_at` is set; `funded_at` unchanged; `deadline_ship_samples = funded_at + 7 days`
4. Creator calls `ship-samples` → succeeds

### Scenario 07 — COA Rejection + Admin Force Refund

1. Create campaign, fund, ship
2. Upload COA without the verification code in text
3. Run OCR → `code_not_found`
4. Admin rejects COA → Assert: `campaign.is_flagged_for_review = true`, `status` still `'samples_sent'`
5. Assert: calling `resolveCampaign` directly throws `ConflictError`
6. Admin calls force-refund → Assert: `status = 'refunded'`, contributions refunded

### Scenario 08 — Deposit and Withdrawal (On-Chain)

1. Register user; get deposit address
2. On-chain: transfer 5 USDC from test master wallet to the deposit address (devnet)
3. Run deposit scanner
4. Assert: `LedgerAccount.balance_usdc = 5`
5. Assert: `ProcessedDepositSignature` row exists
6. Assert: `LedgerTransaction { type: deposit, onchain_signature: <sweep sig> }`
7. Withdraw $3 → run withdrawal worker
8. Assert: on-chain USDC transfer of $3 occurred
9. Assert: `LedgerAccount.balance_usdc = 2`
10. Attempt withdraw $10 → `InsufficientBalanceError (422)`
11. Attempt withdraw to `"not-a-real-address"` → `ValidationError (400)`
12. Run scanner again with same signature → Assert: no duplicate credit (idempotency)

### Scenario 09 — Multi-Sample Campaign

1. Create campaign with 2 samples at different labs
2. Fund + ship; upload and verify COA for sample 1 only
3. Assert: `campaign.status = 'samples_sent'` (not all samples verified)
4. Upload and verify COA for sample 2
5. Assert: `campaign.status = 'resolved'`; payout = total escrow × (1 − fee%)

### Scenario 10 — Fee Validation

1. Set `platform_fee_percent = 10` in config table directly
2. Contribute $10 total → fund → ship → COA → approve → resolve
3. Assert: creator receives $9.00, `fee_account.balance_usdc = 1.00`
4. Admin sweeps fees → run withdrawal worker
5. Assert: on-chain transfer of $1.00; `fee_account.balance_usdc = 0`

### Scenario 11 — Concurrent Contribution Safety

1. Create campaign ($3 target, 100% threshold)
2. Create 10 contributors, each `creditLedger` $1
3. Simultaneously submit 10 contributions of $1 via `Promise.all`
4. Wait for all to settle
5. Assert: `campaign.current_funding_usd` matches the sum of successful contributions
6. Assert: No contributor's `balance_usdc` went negative (DB constraint would have prevented it)
7. Assert: `campaign_escrow.balance_usdc = campaign.current_funding_usd`
8. Assert: Count of `LedgerTransaction { type: contribution }` = count of successful contributions

### Scenario 12 — Email Verification Gate

1. Register user (unverified by default)
2. Attempt to contribute → Assert: `AuthorizationError (403)` — unverified
3. Attempt to create campaign → Assert: `AuthorizationError (403)` — unverified
4. Call `POST /auth/verify-email` with valid token
5. Assert: `user.email_verified = true`
6. Retry contribute → succeeds

### Scenario 13 — Refresh Token Security

1. Login → receive `refreshToken A`
2. Use token A → receive `refreshToken B`, token A marked `used_at`
3. Attempt to use token A again → `AuthenticationError`; all tokens for user deleted (replay detected)
4. Attempt to use token B → `AuthenticationError` (was invalidated in step 3)
5. User must log in again

---

## 14. Security Constraints

| Constraint                | Implementation                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Deposit private keys      | AES-256-GCM with `ENCRYPTION_KEY`; never logged, never in API response                                    |
| Master wallet key         | `MASTER_WALLET_PRIVATE_KEY` env var only; only accessed in `solana.service.ts` and `withdrawal.worker.ts` |
| Deposit idempotency       | `ProcessedDepositSignature` unique constraint; skip on duplicate                                          |
| Withdrawal double-spend   | Check on-chain signature before retry; never resubmit if signature exists                                 |
| Refresh token replay      | Detect reuse via `used_at` → revoke all user sessions                                                     |
| Balance constraints       | `CHECK (balance >= 0)` at DB level; pre-check in application code                                         |
| SERIALIZABLE transactions | All balance-debit/credit operations                                                                       |
| Append-only ledger        | `LedgerTransaction`: no DELETE; UPDATE only allowed on `status` of withdrawals                            |
| JWT                       | Access 15 min; stateless. Refresh 7 days; stored, single-use, rotated.                                    |
| Rate limiting             | Express middleware; 100 req/min global, 10 on `/auth/*`, 5 on `/campaigns/verification-code`              |
| Banned users              | `is_banned` checked on every authenticated write; refresh tokens deleted on ban                           |
| COA MIME check            | `file-type` library magic-byte check; do NOT trust HTTP `Content-Type`                                    |
| S3 access                 | Private bucket; `file_url` in DB is object key; API returns pre-signed URLs only                          |
| Admin routes              | `admin` claim checked in middleware; no client-provided role is trusted                                   |
| Email verification        | `email_verified = true` required for contributions and campaign creation                                  |
| Reconciliation            | Discrepancy triggers operator alert; never auto-correct                                                   |
| AuditLog                  | Every state-mutating operation writes an audit row; failure does not roll back the business op            |
