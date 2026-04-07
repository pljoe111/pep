# PepLab — Changelog

> Generated 2026-04-05. Covers all backend controller additions and the full admin panel frontend rebuild.

---

## Table of Contents

1. [Backend — Controller Changes](#1-backend--controller-changes)
   - [AdminController](#11-admincontroller)
   - [LabController](#12-labcontroller)
   - [TestController](#13-testcontroller)
   - [VendorController](#14-vendorcontroller)
   - [PeptideController](#15-peptidecontroller)
2. [Backend — Service Changes](#2-backend--service-changes)
3. [Common — DTO Changes](#3-common--dto-changes)
4. [Frontend — Admin Panel Rebuild](#4-frontend--admin-panel-rebuild)
   - [Entry Point & Routing](#41-entry-point--routing)
   - [Shared Components](#42-shared-components)
   - [Tab: Campaigns](#43-tab-campaigns)
   - [Tab: Labs](#44-tab-labs)
   - [Tab: Peptides](#45-tab-peptides)
   - [Tab: Vendors](#46-tab-vendors)
   - [Tab: Users](#47-tab-users)
   - [Tab: Config](#48-tab-config)
   - [Tab: Actions](#49-tab-actions)
5. [Frontend — API Hooks](#5-frontend--api-hooks)
6. [Screens Required (Admin Panel)](#6-screens-required-admin-panel)

---

## 1. Backend — Controller Changes

### 1.1 AdminController

**File:** [`packages/bff/src/controllers/admin.controller.ts`](packages/bff/src/controllers/admin.controller.ts)

All routes require `@Security('jwt')` with an `admin` claim. Route base: `/admin`.

| Method | Path                              | Body DTO               | Response                                  | Description                                                                           |
| ------ | --------------------------------- | ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET`  | `/admin/campaigns`                | —                      | `PaginatedResponseDto<CampaignDetailDto>` | List all campaigns. Filterable by `status`, `flagged`, `page`, `limit`.               |
| `GET`  | `/admin/users/{userId}/campaigns` | —                      | `PaginatedResponseDto<CampaignDetailDto>` | List campaigns for a specific user.                                                   |
| `POST` | `/admin/campaigns/{id}/refund`    | `AdminRefundDto`       | `CampaignDetailDto`                       | Force-refund a campaign; requires `reason`. Irreversible.                             |
| `POST` | `/admin/campaigns/{id}/flag`      | `AdminFlagCampaignDto` | `CampaignDetailDto`                       | Flag or unflag a campaign for review.                                                 |
| `POST` | `/admin/campaigns/{id}/hide`      | `AdminHideCampaignDto` | `CampaignDetailDto`                       | Show/hide a campaign from the public feed.                                            |
| `POST` | `/admin/coas/{id}/verify`         | `AdminVerifyCoaDto`    | `CoaDto`                                  | Approve or reject a Certificate of Analysis.                                          |
| `GET`  | `/admin/users`                    | —                      | `PaginatedResponseDto<UserDto>`           | List users; supports `search` (email/username), `page`, `limit`.                      |
| `POST` | `/admin/users/{id}/ban`           | `AdminBanUserDto`      | `UserDto`                                 | Ban or unban a user. Banning revokes all refresh tokens immediately.                  |
| `POST` | `/admin/users/{id}/claims`        | `AdminClaimDto`        | `UserDto`                                 | Grant or revoke a claim (`admin`, `contributor`, `campaign_creator`, `lab_approver`). |
| `GET`  | `/admin/config`                   | —                      | `ConfigurationDto[]`                      | Fetch all platform configuration keys.                                                |
| `PUT`  | `/admin/config/{key}`             | `AdminUpdateConfigDto` | `ConfigurationDto`                        | Update a single config key's value. Audit-logged.                                     |
| `POST` | `/admin/fee-sweep`                | `AdminFeeSweepDto`     | `FeeSweepResponseDto`                     | Sweep accumulated platform fees to an external address. Enqueues a withdrawal job.    |
| `POST` | `/admin/consolidate`              | —                      | `ConsolidationResponseDto`                | Trigger USDC→USDT swap on master wallet via Jupiter (only if balance ≥ threshold).    |
| `GET`  | `/admin/treasury`                 | —                      | `TreasuryDto`                             | On-chain snapshot of master wallet + fee account + ledger totals.                     |

#### Key Notes

- [`forceRefund`](packages/bff/src/controllers/admin.controller.ts:76) delegates to `CampaignService.refundContributions` — cascades ledger reversals.
- [`sweepFees`](packages/bff/src/controllers/admin.controller.ts:176) runs in a `SERIALIZABLE` transaction: zeroes fee account, creates a `LedgerTransaction` (withdrawal/pending), then enqueues the on-chain withdrawal job.
- [`getTreasury`](packages/bff/src/controllers/admin.controller.ts:200) is a read-only snapshot; it computes `pending_fees_estimate` in-memory from active escrows without writing any rows.
- [`banUser`](packages/bff/src/controllers/admin.controller.ts:133) additionally calls `prisma.refreshToken.deleteMany` for immediate session revocation.
- All mutating endpoints audit-log via `AuditService`.

---

### 1.2 LabController

**File:** [`packages/bff/src/controllers/lab.controller.ts`](packages/bff/src/controllers/lab.controller.ts)

Route base: `/labs`. Public reads; writes require JWT.

| Method   | Path                                   | Auth   | Body DTO           | Response                       | Description                                                                                |
| -------- | -------------------------------------- | ------ | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET`    | `/labs`                                | Public | —                  | `PaginatedResponseDto<LabDto>` | List labs. `approved_only` and `active_only` query params. Defaults to `active_only=true`. |
| `GET`    | `/labs/{id}`                           | Public | —                  | `LabDetailDto`                 | Lab detail including its `tests: LabTestDto[]`.                                            |
| `POST`   | `/labs`                                | JWT    | `CreateLabDto`     | `LabDto`                       | Create a new pending lab.                                                                  |
| `PATCH`  | `/labs/{id}`                           | JWT    | `UpdateLabDto`     | `LabDto`                       | Update lab metadata (name, country, phone, address).                                       |
| `POST`   | `/labs/{id}/approve`                   | JWT    | —                  | `LabDto`                       | Approve a pending lab. Sets `is_approved=true` and stamps `approved_at`.                   |
| `POST`   | `/labs/{id}/tests`                     | JWT    | `CreateLabTestDto` | `LabTestDto`                   | Add a test to a lab with price, turnaround, vials, and endotoxin mode.                     |
| `PATCH`  | `/labs/{id}/tests/{testId}`            | JWT    | `UpdateLabTestDto` | `LabTestDto`                   | Update an existing lab-test's price, days, vials, or endotoxin mode.                       |
| `DELETE` | `/labs/{id}/tests/{testId}`            | JWT    | —                  | `void`                         | **Soft delete** — deactivates the lab-test (`is_active=false`).                            |
| `POST`   | `/labs/{id}/tests/{testId}/delete`     | JWT    | —                  | `void`                         | **Hard delete** — permanently removes a disabled lab-test. 409 if still active.            |
| `DELETE` | `/labs/{id}`                           | JWT    | —                  | `void`                         | **Soft delete** — deactivates the lab and all its tests.                                   |
| `POST`   | `/labs/{id}/delete`                    | JWT    | —                  | `void`                         | **Hard delete** — permanently removes the lab. 409 if any lab-test records exist.          |
| `POST`   | `/labs/{id}/reactivate`                | JWT    | —                  | `void`                         | Reactivate a deactivated lab.                                                              |
| `POST`   | `/labs/{id}/tests/{testId}/reactivate` | JWT    | —                  | `void`                         | Reactivate a deactivated lab-test.                                                         |

#### Key Notes

- **Soft vs. hard delete pattern:** `DELETE /labs/:id` deactivates; `POST /labs/:id/delete` permanently removes. Same dual pattern applies to lab-tests. This prevents accidental data loss.
- `OperationId` decorators are set explicitly (`PermanentDeleteLab`, `PermanentDeleteLabTest`, `GetAllLabs`, `GetLabById`) so the generated OpenAPI spec and `api-client` keep stable operation names.

---

### 1.3 TestController

**File:** [`packages/bff/src/controllers/test.controller.ts`](packages/bff/src/controllers/test.controller.ts)

Route base: `/tests`. Test catalog management.

| Method   | Path                              | Auth   | Body DTO                     | Response                 | Description                                                                                    |
| -------- | --------------------------------- | ------ | ---------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET`    | `/tests`                          | Public | —                            | `TestDto[]`              | List tests. `active_only` query param (default behavior determined by caller).                 |
| `POST`   | `/tests`                          | JWT    | `CreateTestDto`              | `TestDto`                | Create a new test type.                                                                        |
| `PATCH`  | `/tests/{id}`                     | JWT    | `UpdateTestDto`              | `TestDto`                | Update a test's name, description, USP code, or vials required.                                |
| `POST`   | `/tests/{id}/disable`             | JWT    | —                            | `void`                   | Disable a test **and cascade** to all lab-tests that offer it.                                 |
| `POST`   | `/tests/{id}/enable`              | JWT    | —                            | `void`                   | Re-enable a disabled test type.                                                                |
| `DELETE` | `/tests/{id}`                     | JWT    | —                            | `void`                   | Permanently delete a test type. 409 if any lab-test records (active or inactive) reference it. |
| `GET`    | `/tests/{testId}/claim-templates` | Public | —                            | `TestClaimTemplateDto[]` | List claim templates for a test.                                                               |
| `POST`   | `/tests/{testId}/claim-templates` | JWT    | `CreateTestClaimTemplateDto` | `TestClaimTemplateDto`   | Add a claim template field (mass, purity, identity, endotoxins, sterility, other).             |
| `PATCH`  | `/tests/claim-templates/{id}`     | JWT    | `UpdateTestClaimTemplateDto` | `TestClaimTemplateDto`   | Update label, required flag, or sort order of an existing claim template.                      |
| `DELETE` | `/tests/claim-templates/{id}`     | JWT    | —                            | `void`                   | Permanently delete a claim template.                                                           |

#### Key Notes

- `POST /tests/{id}/disable` **cascades** — calls `LabService.deactivateTestCascade` internally (or equivalent) to also deactivate all `LabTest` rows referencing this test.
- `DELETE /tests/{id}` is hard-blocked by a database FK guard; all lab-test records referencing the test must be deleted first.
- Claim templates define the structured fields that labs must fill when uploading CoA results for a specific test type.

---

### 1.4 VendorController

**File:** [`packages/bff/src/controllers/vendor.controller.ts`](packages/bff/src/controllers/vendor.controller.ts)

Route base: `/vendors`.

| Method   | Path                           | Auth   | Body DTO          | Response             | Description                                                                                |
| -------- | ------------------------------ | ------ | ----------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| `GET`    | `/vendors/search?q=`           | Public | —                 | `VendorSummaryDto[]` | Debounced vendor name search for campaign wizard combobox. Returns non-rejected vendors.   |
| `GET`    | `/vendors`                     | JWT    | —                 | `VendorDto[]`        | Admin: full vendor list with optional `status` filter (`pending`, `approved`, `rejected`). |
| `GET`    | `/vendors/{id}`                | JWT    | —                 | `VendorDto`          | Admin: single vendor detail.                                                               |
| `POST`   | `/vendors/submit`              | JWT    | `CreateVendorDto` | `VendorDto`          | User submits a vendor for review (`status=pending`). Wizard continues immediately.         |
| `POST`   | `/vendors`                     | JWT    | `CreateVendorDto` | `VendorDto`          | Admin direct create — auto-approved.                                                       |
| `PATCH`  | `/vendors/{id}`                | JWT    | `UpdateVendorDto` | `VendorDto`          | Admin: update metadata.                                                                    |
| `POST`   | `/vendors/{id}/review`         | JWT    | `ReviewVendorDto` | `VendorDto`          | Admin: approve or reject a vendor. Sets `reviewed_by`, `reviewed_at`, `review_notes`.      |
| `POST`   | `/vendors/{id}/reinstate`      | JWT    | —                 | `VendorDto`          | Admin: set rejected vendor back to approved.                                               |
| `GET`    | `/vendors/{id}/campaign-count` | JWT    | —                 | `{ count: number }`  | Admin: count of active campaigns using this vendor (used for suspension warning).          |
| `DELETE` | `/vendors/{id}`                | JWT    | —                 | `void`               | Admin: permanently delete. 409 if any samples are attached.                                |

#### Key Notes

- Two create paths: `/vendors/submit` (user, pending review) vs. `/vendors` (admin, auto-approved). Both accept `CreateVendorDto`.
- `GET /vendors/{id}/campaign-count` powers the suspension warning UI: show campaign count before confirming a suspend/reject action.
- Suspension is modeled as `POST /vendors/{id}/review` with `{ status: 'rejected' }` — no separate suspend endpoint needed.

---

### 1.5 PeptideController

**File:** [`packages/bff/src/controllers/peptide.controller.ts`](packages/bff/src/controllers/peptide.controller.ts)

Route base: `/peptides`.

| Method   | Path                     | Auth   | Body DTO           | Response              | Description                                                                             |
| -------- | ------------------------ | ------ | ------------------ | --------------------- | --------------------------------------------------------------------------------------- |
| `GET`    | `/peptides`              | Public | —                  | `PeptideSummaryDto[]` | All active, approved peptides. Used by campaign wizard for in-memory fuzzy search.      |
| `GET`    | `/peptides/all`          | JWT    | —                  | `PeptideDto[]`        | Admin: all peptides including unreviewed. `show_unreviewed` query param.                |
| `POST`   | `/peptides/submit`       | JWT    | `CreatePeptideDto` | `PeptideDto`          | User submits a new peptide for review (`is_active=false`). Wizard proceeds immediately. |
| `POST`   | `/peptides`              | JWT    | `CreatePeptideDto` | `PeptideDto`          | Admin direct create — auto-approved and active.                                         |
| `PATCH`  | `/peptides/{id}`         | JWT    | `UpdatePeptideDto` | `PeptideDto`          | Admin: update name, aliases, description, active flag.                                  |
| `POST`   | `/peptides/{id}/approve` | JWT    | —                  | `PeptideDto`          | Admin: approve a pending peptide. Sets `is_active=true`, `approved_by`, `approved_at`.  |
| `POST`   | `/peptides/{id}/reject`  | JWT    | —                  | `void`                | Admin: reject a pending peptide.                                                        |
| `POST`   | `/peptides/{id}/disable` | JWT    | —                  | `PeptideDto`          | Admin: disable an active peptide.                                                       |
| `POST`   | `/peptides/{id}/enable`  | JWT    | —                  | `PeptideDto`          | Admin: re-enable a disabled peptide.                                                    |
| `DELETE` | `/peptides/{id}`         | JWT    | —                  | `void`                | Admin: permanently delete. 409 if any campaign samples reference it.                    |

#### Key Notes

- Same dual-create pattern as vendors: `/peptides/submit` for users, `/peptides` for admin.
- `GET /peptides` (public) returns only active + approved for the wizard combobox. `GET /peptides/all` is the admin-only view with unreviewed items.

---

## 2. Backend — Service Changes

### AdminService — `getTreasury`

[`packages/bff/src/services/admin.service.ts`](packages/bff/src/services/admin.service.ts:324)

New method. Reads `MasterWallet`, `FeeAccount`, `LedgerAccount` aggregate, and `CampaignEscrow` aggregate in parallel. Computes `pending_fees_estimate` in-memory (no new DB writes) by iterating all active-status campaign escrows and multiplying each balance by its `platform_fee_percent`. Returns [`TreasuryDto`](packages/common/src/dtos/admin.dto.ts:86).

### AdminService — `sweepFees` (Option B)

[`packages/bff/src/services/admin.service.ts`](packages/bff/src/services/admin.service.ts:274)

Updated to use the **unified `balance` field** (Option B — single balance, no `balance_usdc`/`balance_usdt` on `FeeAccount`). Always creates the withdrawal ledger row with `currency: 'usdt'` regardless of the `dto.currency` field, since all on-chain withdrawals are USDT under Option B.

---

## 3. Common — DTO Changes

**File:** [`packages/common/src/dtos/admin.dto.ts`](packages/common/src/dtos/admin.dto.ts)

| Interface / Class          | Change                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `TreasuryDto`              | **New.** Nested shape: `master_wallet` (public key, USDC/USDT balances, last synced), `fee_account` (balance, pending estimate, exposure, sweep availability), `ledger` (total user + escrow balances). |
| `ConsolidationResponseDto` | **New.** `{ triggered: boolean; message: string }` — response from Jupiter consolidation endpoint.                                                                                                      |
| `AdminFeeSweepDto`         | `destination_address` (required string) + `currency` (`'usdc'                                                                                                                                           | 'usdt'`).  |
| `AdminClaimDto`            | `claim_type` validated against `['campaign_creator', 'contributor', 'lab_approver', 'admin']`; `action` is `'grant'                                                                                     | 'revoke'`. |

---

## 4. Frontend — Admin Panel Rebuild

The monolithic `AdminPage.tsx` (~2900 lines) was deleted and replaced with a structured component tree under `packages/fe/src/pages/admin/`.

### 4.1 Entry Point & Routing

| File                                                                                     | Change                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`packages/fe/src/pages/admin/AdminPage.tsx`](packages/fe/src/pages/admin/AdminPage.tsx) | **New.** Admin guard (`claims.includes('admin')`), `Tabs` with 7 tabs, zero business logic. |
| [`packages/fe/src/routes/index.tsx`](packages/fe/src/routes/index.tsx)                   | Import path updated from `'../pages/AdminPage'` → `'../pages/admin/AdminPage'`.             |

---

### 4.2 Shared Components

All under `packages/fe/src/pages/admin/components/shared/`.

| Component                                                                                        | Purpose                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`AdminStatusBadge.tsx`](packages/fe/src/pages/admin/components/shared/AdminStatusBadge.tsx)     | Single source of truth mapping status strings to `Badge` variants: `approved→green`, `pending→amber`, `rejected→red`, `active→teal`, `disabled→gray`, `flagged→amber`, `hidden→gray`, `banned→red`, `unverified→amber`. |
| [`AdminFilterBar.tsx`](packages/fe/src/pages/admin/components/shared/AdminFilterBar.tsx)         | Horizontal scrollable pill toggle row. Props: `options[]`, `value`, `onChange`. Active pill: `bg-primary-l border-primary text-primary`.                                                                                |
| [`AdminSectionHeader.tsx`](packages/fe/src/pages/admin/components/shared/AdminSectionHeader.tsx) | `title` left + optional `action` node right. Used above every list section.                                                                                                                                             |
| [`AdminActionButton.tsx`](packages/fe/src/pages/admin/components/shared/AdminActionButton.tsx)   | Thin wrapper enforcing `size="sm"` on all admin action buttons. Variants: `ghost`, `danger`, `primary`.                                                                                                                 |
| [`AdminConfirmModal.tsx`](packages/fe/src/pages/admin/components/shared/AdminConfirmModal.tsx)   | Required gate for every destructive action. Props: `title`, `body` (ReactNode), `confirmLabel`, `confirmVariant`, `onConfirm`, `onClose`, `isPending`. Renders via `Modal`.                                             |
| [`AdminEmptyState.tsx`](packages/fe/src/pages/admin/components/shared/AdminEmptyState.tsx)       | Wraps `EmptyState` with a default "Nothing here yet" message.                                                                                                                                                           |

---

### 4.3 Tab: Campaigns

**File:** [`packages/fe/src/pages/admin/tabs/CampaignsTab.tsx`](packages/fe/src/pages/admin/tabs/CampaignsTab.tsx)

**Data:** `useAdminCampaigns({ status, flagged })` — paginated. Client-side search on title + verification code.

**State:** `statusFilter`, `flaggedOnly`, `search`, `flagModal` (campaignId), `refundModal` (CampaignDetailDto).

**Actions:**

| Action             | Trigger                                            | Modal?                                  |
| ------------------ | -------------------------------------------------- | --------------------------------------- |
| Flag               | `AdminActionButton`                                | `CampaignFlagModal` — requires reason   |
| Unflag             | `AdminActionButton`                                | Direct call — no modal                  |
| Hide / Unhide      | `AdminActionButton`                                | Direct call                             |
| Refund             | `AdminActionButton` (only for `created`/`funded`)  | `CampaignRefundModal` — requires reason |
| Approve Resolution | `AdminActionButton` (only for `results_published`) | Direct call                             |

**Sub-components:**

| File                                                                                                  | Description                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`CampaignRow.tsx`](packages/fe/src/pages/admin/components/campaigns/CampaignRow.tsx)                 | Card with title (link to campaign), creator, verification code `<code>`, date, status badge, action buttons. |
| [`CampaignFlagModal.tsx`](packages/fe/src/pages/admin/components/campaigns/CampaignFlagModal.tsx)     | Form with required reason textarea.                                                                          |
| [`CampaignRefundModal.tsx`](packages/fe/src/pages/admin/components/campaigns/CampaignRefundModal.tsx) | Warning card + current funding display + required reason textarea + danger confirm button.                   |

---

### 4.4 Tab: Labs

**File:** [`packages/fe/src/pages/admin/tabs/LabsTab.tsx`](packages/fe/src/pages/admin/tabs/LabsTab.tsx)

**Data:** `useLabs(false, !showDisabled)` + `useTests(!showDisabled)` + `useLabDetail(editLabId)`.

**Sections:**

1. **Labs list** — `LabList` → `LabRow` cards.
2. **Test Catalog** — `TestCatalog` → `TestCatalogRow` (expandable claim templates).

**Actions matrix:**

| Item State             | Available Actions                           |
| ---------------------- | ------------------------------------------- |
| Lab: pending + active  | Approve                                     |
| Lab: approved + active | Edit (opens `LabModal`), Disable            |
| Lab: inactive          | Reactivate, Delete (opens `DeleteLabModal`) |
| Test: active           | Disable (opens `DisableTestModal`)          |
| Test: inactive         | Enable, Delete (opens `DeleteTestModal`)    |
| Lab-test: active       | Disable, per-row Save edits                 |
| Lab-test: inactive     | Reactivate, Delete, Hard delete             |

**Sub-components (labs/):**

| File                                                                                       | Description                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`LabRow.tsx`](packages/fe/src/pages/admin/components/labs/LabRow.tsx)                     | Lab card — name, country, approve/edit/disable/reactivate/delete buttons.                                                                                                    |
| [`LabList.tsx`](packages/fe/src/pages/admin/components/labs/LabList.tsx)                   | List wrapper with `AdminEmptyState`.                                                                                                                                         |
| [`LabModal.tsx`](packages/fe/src/pages/admin/components/labs/LabModal.tsx)                 | Create/Edit modal (`size="lg"`). Name, country, phone, address fields + embedded `LabTestTable`. Create flow: POST lab then POST each pending test.                          |
| [`LabTestTable.tsx`](packages/fe/src/pages/admin/components/labs/LabTestTable.tsx)         | Dual-mode: `edit` (live rows from API) / `create` (pending list pre-submission). Column header + `LabTestRow` list + `AddTestToLabForm`. Exports `PendingLabTest` interface. |
| [`LabTestRow.tsx`](packages/fe/src/pages/admin/components/labs/LabTestRow.tsx)             | Inline-editable row for price, days, vials, endotoxin mode. Save calls `labsApi.updateTest` directly. Per-row disable/reactivate/delete controls.                            |
| [`AddTestToLabForm.tsx`](packages/fe/src/pages/admin/components/labs/AddTestToLabForm.tsx) | Select test + price/days/vials inputs + endotoxin mode (only when test has endotoxins claim template). Validates before calling `onAdd`.                                     |
| [`DeleteLabModal.tsx`](packages/fe/src/pages/admin/components/labs/DeleteLabModal.tsx)     | Wraps `AdminConfirmModal` with permanent-delete warning.                                                                                                                     |

**Sub-components (tests/):**

| File                                                                                                  | Description                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [`TestCatalogRow.tsx`](packages/fe/src/pages/admin/components/tests/TestCatalogRow.tsx)               | Test name + description + status badge + disable/enable/delete buttons. Expandable claim templates disclosure.           |
| [`TestCatalog.tsx`](packages/fe/src/pages/admin/components/tests/TestCatalog.tsx)                     | Renders `AdminSectionHeader` + list of `TestCatalogRow`.                                                                 |
| [`TestClaimTemplateRow.tsx`](packages/fe/src/pages/admin/components/tests/TestClaimTemplateRow.tsx)   | Inline-editable row: claim kind select, label, required checkbox, sort order. Save PATCHes `/tests/claim-templates/:id`. |
| [`TestClaimTemplateList.tsx`](packages/fe/src/pages/admin/components/tests/TestClaimTemplateList.tsx) | Renders existing templates + "+ Add Claim Template" button toggling a blank new row.                                     |
| [`CreateTestModal.tsx`](packages/fe/src/pages/admin/components/tests/CreateTestModal.tsx)             | Name, description, USP code, vials + pending claim templates section. Creates test then POSTs each template.             |
| [`DisableTestModal.tsx`](packages/fe/src/pages/admin/components/tests/DisableTestModal.tsx)           | Warns about cascade to all labs offering this test. `confirmVariant="danger"`.                                           |
| [`DeleteTestModal.tsx`](packages/fe/src/pages/admin/components/tests/DeleteTestModal.tsx)             | Two-card warning: permanent deletion + lab cascade note. `confirmVariant="danger"`.                                      |

---

### 4.5 Tab: Peptides

**File:** [`packages/fe/src/pages/admin/tabs/PeptidesTab.tsx`](packages/fe/src/pages/admin/tabs/PeptidesTab.tsx)

**Data:** `useAllPeptides(showUnreviewed)`.

**Peptide state machine in `PeptideRow`:**

| Peptide State                                     | Available Buttons                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `!is_active && approved_at === null` (Unreviewed) | Approve (primary, direct), Reject (danger → `RejectPeptideModal`) |
| `is_active` (Active)                              | Edit (→ `PeptideModal`), Disable (direct)                         |
| `!is_active && approved_at !== null` (Disabled)   | Enable (direct), Delete (→ `AdminConfirmModal`)                   |

**Sub-components:**

| File                                                                                               | Description                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`PeptideRow.tsx`](packages/fe/src/pages/admin/components/peptides/PeptideRow.tsx)                 | Name + comma-joined aliases + 1-line description + status badge + action buttons.                                  |
| [`PeptideModal.tsx`](packages/fe/src/pages/admin/components/peptides/PeptideModal.tsx)             | Name, aliases (tag chip input — Enter/comma to add, × to remove), description textarea, active toggle (edit only). |
| [`RejectPeptideModal.tsx`](packages/fe/src/pages/admin/components/peptides/RejectPeptideModal.tsx) | Optional review notes textarea + danger confirm.                                                                   |

---

### 4.6 Tab: Vendors

**File:** [`packages/fe/src/pages/admin/tabs/VendorsTab.tsx`](packages/fe/src/pages/admin/tabs/VendorsTab.tsx)

**Data:** `useAllVendors(statusFilter)`. Filter options: `All | Pending | Approved | Rejected`.

**Vendor state machine in `VendorRow`:**

| Vendor Status | Available Buttons                                                                             |
| ------------- | --------------------------------------------------------------------------------------------- |
| `pending`     | Approve (primary, direct `reviewVendor` with `approved`), Reject (→ `RejectVendorModal`)      |
| `approved`    | Edit (→ `VendorModal`), Suspend (→ `AdminConfirmModal`, calls `reviewVendor` with `rejected`) |
| `rejected`    | Reinstate (direct), Delete (→ `AdminConfirmModal`)                                            |

**Sub-components:**

| File                                                                                            | Description                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`VendorRow.tsx`](packages/fe/src/pages/admin/components/vendors/VendorRow.tsx)                 | Name + website + country + submitter + date + status badge + action buttons.                      |
| [`VendorList.tsx`](packages/fe/src/pages/admin/components/vendors/VendorList.tsx)               | Thin wrapper with `AdminEmptyState`.                                                              |
| [`VendorModal.tsx`](packages/fe/src/pages/admin/components/vendors/VendorModal.tsx)             | Name (required), website, country, telegram group, contact notes, status select (edit mode only). |
| [`RejectVendorModal.tsx`](packages/fe/src/pages/admin/components/vendors/RejectVendorModal.tsx) | `review_notes` textarea **required** (blocks confirm if empty).                                   |

---

### 4.7 Tab: Users

**File:** [`packages/fe/src/pages/admin/tabs/UsersTab.tsx`](packages/fe/src/pages/admin/tabs/UsersTab.tsx)

**Data:** `useAdminUsers(debouncedSearch)`. Client-side filter: `all | banned | unverified`.

**Sub-components:**

| File                                                                                      | Description                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`UserRow.tsx`](packages/fe/src/pages/admin/components/users/UserRow.tsx)                 | Username + email + joined date + email-verified badge + banned badge + View/Ban/Unban buttons.        |
| [`UserList.tsx`](packages/fe/src/pages/admin/components/users/UserList.tsx)               | Thin wrapper with `AdminEmptyState`.                                                                  |
| [`UserDetailModal.tsx`](packages/fe/src/pages/admin/components/users/UserDetailModal.tsx) | Read-only: email, username, join date, email verified badge, balance (`formatUSD`), claims as badges. |
| [`BanUserModal.tsx`](packages/fe/src/pages/admin/components/users/BanUserModal.tsx)       | Warns that all active sessions will be revoked. `confirmVariant="danger"`.                            |

---

### 4.8 Tab: Config

**File:** [`packages/fe/src/pages/admin/tabs/ConfigTab.tsx`](packages/fe/src/pages/admin/tabs/ConfigTab.tsx)

**Data:** `useAdminConfig()`. Mutations: `useAdminUpdateConfig()`.

**Sub-components:**

| File                                                                           | Description                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ConfigRow.tsx`](packages/fe/src/pages/admin/components/config/ConfigRow.tsx) | Adaptive input per value type: boolean→toggle, number→number input, string→text input, object→per-key inputs, array→chip tag list, other→JSON textarea. Ghost "Save" button disabled when no changes. Updated-at timestamp displayed. |

---

### 4.9 Tab: Actions

**File:** [`packages/fe/src/pages/admin/tabs/ActionsTab.tsx`](packages/fe/src/pages/admin/tabs/ActionsTab.tsx)

**Manual Fee Sweep card:**

- Fee account balance display (from `useAdminConfig`).
- Destination address input (`font-mono`).
- "Run Fee Sweep" button → `AdminConfirmModal` → calls `sweepFees` for USDC then USDT. Toasts each result.

---

## 5. Frontend — API Hooks

### `useLabs.ts` additions

**File:** [`packages/fe/src/api/hooks/useLabs.ts`](packages/fe/src/api/hooks/useLabs.ts)

New hooks added to support the admin panel (previously only basic lab queries existed):

| Hook                            | Description                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useApproveLab()`               | POST `/labs/:id/approve`. Invalidates lab list queries.                                              |
| `useDeactivateLabTest()`        | DELETE `/labs/:id/tests/:testId`. Invalidates lab detail.                                            |
| `useAddLabTest()`               | POST `/labs/:id/tests`. Invalidates lab detail.                                                      |
| `useDeactivateLab()`            | DELETE `/labs/:id`. Invalidates lab list.                                                            |
| `useReactivateLab()`            | POST `/labs/:id/reactivate`. Invalidates lab list.                                                   |
| `useReactivateLabTest()`        | POST `/labs/:id/tests/:testId/reactivate`. Invalidates lab detail.                                   |
| `useDisableTest()`              | POST `/tests/:id/disable` via `axiosInstance`. Invalidates all `['tests']` and `['labs']` (cascade). |
| `useEnableTest()`               | POST `/tests/:id/enable` via `axiosInstance`. Invalidates all `['tests']`.                           |
| `useDeleteLab()`                | POST `/labs/:id/delete` via `axiosInstance` (hard delete). Invalidates all `['labs']`.               |
| `useDeleteLabTest()`            | POST `/labs/:id/tests/:testId/delete` via `axiosInstance` (hard delete). Invalidates lab detail.     |
| `useDeleteTest()`               | DELETE `/tests/:id` via `axiosInstance`. Invalidates all `['tests']`.                                |
| `useTestClaimTemplates(testId)` | GET `/tests/:testId/claim-templates`. Only fetches when `testId` is truthy.                          |
| `useCreateTestClaimTemplate()`  | POST `/tests/:testId/claim-templates`. Invalidates claim templates + both test list variants.        |
| `useDeleteTestClaimTemplate()`  | DELETE `/tests/claim-templates/:templateId`. Invalidates claim templates + test lists.               |

---

## 6. Screens Required (Admin Panel)

The following screens need to be designed/implemented in the admin panel frontend. Each maps to a tab and a set of API endpoints.

### Campaigns Screen (`/admin` → "Campaigns" tab)

- **List view** — filterable by status (`created`, `funded`, `samples_sent`, `results_published`, `resolved`, `refunded`) and "Flagged Only" toggle. Debounced search by title or verification code.
- **Campaign row** — shows title (link to public campaign), creator, verification code, status badge, flagged/hidden badges.
- **Flag modal** — reason textarea required. API: `POST /admin/campaigns/:id/flag`.
- **Refund modal** — warning + current funding + reason required. API: `POST /admin/campaigns/:id/refund`. Irreversible.
- **Hide/Unhide** — direct toggle. API: `POST /admin/campaigns/:id/hide`.

### Labs Screen (`/admin` → "Labs" tab)

- **Labs list** — shows pending/approved/active/inactive status. "Show Disabled" toggle reveals inactive labs and tests.
- **Actions dropdown** — "Add Lab" and "Add Test" buttons.
- **Lab row** — approve (pending labs), edit, disable, reactivate, delete controls.
- **LabModal (create/edit)** — lab metadata fields + embedded test table with per-test pricing.
- **AddTestToLabForm** — add tests to a lab with price/days/vials and endotoxin mode inputs.
- **Test catalog** — below labs list. Expandable claim templates per test.
- **CreateTestModal** — test metadata + pending claim templates.
- **DisableTestModal** — cascade warning before disabling.
- **DeleteTestModal** — two-card permanent deletion warning.

### Peptides Screen (`/admin` → "Peptides" tab)

- **List view** — "Show Unreviewed" toggle reveals unreviewed submissions.
- **Peptide row** — status-aware buttons: approve/reject (unreviewed), edit/disable (active), enable/delete (disabled).
- **PeptideModal (create/edit)** — name + tag-chip alias input + description textarea.
- **RejectPeptideModal** — optional notes.

### Vendors Screen (`/admin` → "Vendors" tab)

- **List view** — filterable by status: `All | Pending | Approved | Rejected`.
- **Vendor row** — approve/reject (pending), edit/suspend (approved), reinstate/delete (rejected).
- **VendorModal (create/edit)** — name, website, country, telegram, contact notes, status (edit only).
- **RejectVendorModal** — review notes **required**.
- **Suspend confirm** — campaigns-not-affected warning.

### Users Screen (`/admin` → "Users" tab)

- **List view** — debounced search + filter pills: `All | Banned | Unverified`.
- **User row** — email verified badge, banned badge, View/Ban/Unban actions.
- **UserDetailModal** — read-only: email, username, join date, balance, claims.
- **BanUserModal** — session revocation warning.

### Config Screen (`/admin` → "Config" tab)

- **Config list** — one card per key. Adaptive input by value type (boolean toggle, number, string, object, array, JSON).
- **Save** — per-row ghost button, disabled when no changes. No confirmation modal required.

### Actions Screen (`/admin` → "Actions" tab)

- **Manual Fee Sweep card** — shows fee account balance, destination address input, confirm modal before executing sweep to USDC + USDT. API: `POST /admin/fee-sweep`.
- Future: consolidation trigger, treasury snapshot viewer (APIs already exist at `POST /admin/consolidate` and `GET /admin/treasury`).

---

## Session 2026-04-07 — COA Manual Approval Flow + 3-Strikes Auto-Refund

> Commit: `feat(coa): manual admin approval flow + 3-strikes auto-refund`
> 20 files changed, 1 366 insertions, 18 deletions.

### Database

#### Schema changes ([`packages/bff/prisma/schema.prisma`](packages/bff/prisma/schema.prisma))

| Model      | Change                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `Coa`      | Added `rejection_count Int @default(0)` — monotonic counter incremented on every manual rejection |
| `Campaign` | Added explicit `creator User @relation("CampaignCreator", ...)` relation                          |
| `User`     | Added back-relation `campaigns Campaign[] @relation("CampaignCreator")`                           |
| `Sample`   | Added explicit `target_lab Lab @relation(fields: [target_lab_id], references: [id])` relation     |
| `Lab`      | Added back-relation `samples Sample[]`                                                            |

#### Migrations

| File                                                                                                                                    | Description                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`20260405200000_coa_rejection_count`](packages/bff/prisma/migrations/20260405200000_coa_rejection_count/migration.sql)                 | Intermediate: added `coa_rejection_count` column to `campaign`                                                                 |
| [`20260407160000_coa_rejection_count_per_coa`](packages/bff/prisma/migrations/20260407160000_coa_rejection_count_per_coa/migration.sql) | Final: drops `campaign.coa_rejection_count`, adds `coa.rejection_count` (per-sample granularity is better for fraud detection) |

---

### Backend — BFF

#### [`coa.service.ts`](packages/bff/src/services/coa.service.ts)

- **Decoupled advancement**: only `manually_approved` status can advance a campaign to `results_published`. OCR signals (`code_found` / `code_not_found`) are now purely informational — they no longer gate progression.
- **3-strikes auto-refund**: on every manual rejection the service atomically increments `coa.rejection_count`. When the count reaches **3** the campaign is immediately force-refunded via the existing `CampaignService.refundContributions` path.
- Rejection path is idempotent — re-rejecting an already-rejected COA is a no-op.

#### [`admin.service.ts`](packages/bff/src/services/admin.service.ts)

- `listCoas()` now deep-joins: creator email + username, lab name, target test names, sample mass, OCR text excerpt, and `rejection_count`.

#### [`admin.controller.ts`](packages/bff/src/controllers/admin.controller.ts)

Two new endpoints added (both require `admin` claim):

| Method | Path                      | Description                                                                        |
| ------ | ------------------------- | ---------------------------------------------------------------------------------- |
| `GET`  | `/admin/coas`             | Paginated, filterable (`status`, `campaign_id`, `page`, `limit`) COA list          |
| `POST` | `/admin/coas/:id/run-ocr` | Synchronous on-demand OCR — triggers OCR immediately and returns refreshed COA row |

#### [`ocr.service.ts`](packages/bff/src/services/ocr.service.ts)

- Refactored `processCoaOcr()` to be callable synchronously from the controller, not only from the background worker.

#### [`env.config.ts`](packages/bff/src/config/env.config.ts)

- Added `DISABLE_OCR_WORKER: bool({ default: false })` — when `true`, the background OCR worker is not started. Useful for local dev and CI environments.

#### [`container.ts`](packages/bff/src/container.ts)

- OCR background worker startup is now gated behind `env.DISABLE_OCR_WORKER`.

#### [`packages/common/src/dtos/admin.dto.ts`](packages/common/src/dtos/admin.dto.ts)

`AdminCoaDto` gained four new fields:

| Field              | Type     | Notes                           |
| ------------------ | -------- | ------------------------------- |
| `creator_id`       | `string` | UUID of campaign creator        |
| `creator_email`    | `string` | For admin reference             |
| `creator_username` | `string` | Display name                    |
| `rejection_count`  | `number` | Current per-COA rejection count |

---

### Backend — Tests

#### [`coa.service.test.ts`](packages/bff/src/services/__tests__/coa.service.test.ts) _(new file)_

New test cases covering:

- First rejection increments `rejection_count` to 1.
- Second rejection increments to 2 — no refund triggered.
- Third rejection increments to 3 — `refundContributions` is called.
- Approving a COA advances campaign status to `results_published`.
- Re-rejecting an already-rejected COA is a no-op (idempotent).

---

### Frontend — Admin UI

#### [`AdminPage.tsx`](packages/fe/src/pages/admin/AdminPage.tsx)

- Added **"COAs"** tab to the admin tab bar.
- All tabs now read/write a `tab` URL search parameter so tabs are deep-linkable and survive page refresh.

#### [`CoasTab.tsx`](packages/fe/src/pages/admin/tabs/CoasTab.tsx) _(new file)_

Full COA management view:

- Paginated list with full context per row: campaign name, creator, lab, target tests, sample mass, COA status badge, rejection count badge.
- Inline accordion **PDF viewer** — admins can inspect the document without leaving the list.
- **Run OCR** action button per row.
- Filter bar: status (`pending_review`, `manually_approved`, `manually_rejected`, `code_found`, `code_not_found`).

#### [`CoaVerifyModal.tsx`](packages/fe/src/pages/admin/components/coas/CoaVerifyModal.tsx) _(new file)_

- Approve / Reject modal with optional verification notes.
- Displays a **rejection-count warning** when `rejection_count >= 2`, alerting the admin that the next rejection will auto-refund the campaign.

#### [`AdminStatusBadge.tsx`](packages/fe/src/pages/admin/components/shared/AdminStatusBadge.tsx)

- Extended with new variants: `code_found`, `code_not_found`, `manually_approved`, `manually_rejected`, `pending_review`.

#### [`useAdmin.ts`](packages/fe/src/api/hooks/useAdmin.ts)

Three new React Query hooks:

| Hook                    | Method | Endpoint                  |
| ----------------------- | ------ | ------------------------- |
| `useAdminCoas(filters)` | `GET`  | `/admin/coas`             |
| `useVerifyCoa()`        | `POST` | `/admin/coas/:id/verify`  |
| `useRunOcr()`           | `POST` | `/admin/coas/:id/run-ocr` |

#### [`queryKeys.ts`](packages/fe/src/api/queryKeys.ts)

- Added `adminCoas` key factory: `['admin', 'coas', filters]`.

#### [`UsersTab.tsx`](packages/fe/src/pages/admin/tabs/UsersTab.tsx)

- Minor: reads/writes `search` URL search param (consistent with new deep-linking pattern).

---

### Design decisions

| Decision                               | Rationale                                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counter lives on `Coa`, not `Campaign` | Tracking per-sample is more precise — you know exactly which COA triggered the refund, and a campaign with multiple samples can have different COA health |
| Auto-refund at 3 rejections, not 2     | Gives creators one more attempt after the first two rejections before losing the campaign                                                                 |
| OCR signals decoupled from advancement | Prevents a broken OCR model from blocking legitimate campaigns; human review is always the final gate                                                     |
| `DISABLE_OCR_WORKER` flag              | Lets local dev / CI run without GPU/API keys; on-demand OCR endpoint covers manual testing                                                                |
