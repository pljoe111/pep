# Admin Panel Improvements Plan

## Overview

Improvements to the admin panel covering: config management UX, campaign review workflow, quick campaign previews, user management, and general quality-of-life upgrades.

---

## 1. Config — Inline Editing via DB (already persisted, UX missing)

**Current state:** Config is already stored in the DB and seeded from [`packages/bff/prisma/seed.ts`](packages/bff/prisma/seed.ts). The `PUT /admin/config/:key` endpoint ([`packages/bff/src/controllers/admin.controller.ts:152`](packages/bff/src/controllers/admin.controller.ts:152)) exists but the frontend just shows a "contact dev" button ([`packages/fe/src/pages/AdminPage.tsx:244`](packages/fe/src/pages/AdminPage.tsx:244)).

**Goal:** Replace the "contact dev" button with real inline editing.

### Changes needed

- **[`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx)**
  - Add inline JSON editor per config row (expandable textarea pre-filled with current value).
  - Save button calls `PUT /admin/config/:key`.
  - Show validation errors from the server.
  - Wire up `useAdminUpdateConfig` mutation (already present in [`packages/fe/src/api/hooks/useAdmin.ts`](packages/fe/src/api/hooks/useAdmin.ts) but unused on the page).

- **No backend changes required** — endpoint and service already work.

---

## 2. Campaign Review — Rename "Unflag" → "Mark Reviewed"

**Current state:** When a campaign is flagged, the button reads "Unflag" ([`packages/fe/src/pages/AdminPage.tsx:192`](packages/fe/src/pages/AdminPage.tsx:192)). This is confusing — it implies the flag is wrong, not that a human has looked at it and cleared it.

**Goal:** The action of clearing a flag should communicate _review completion_, not flag removal.

### Changes needed

- **[`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx)**
  - Change button label from "Unflag" → "Mark Reviewed" when `campaign.is_flagged_for_review === true`.
  - Optionally show a confirmation prompt ("Mark as reviewed and clear flag?").
  - Toast message: "Campaign marked as reviewed" instead of "Campaign unflagged".
  - The `flagged: false` DTO payload stays the same — purely a label/UX change.

---

## 3. Campaign Quick View — Expandable Detail Panel

**Current state:** [`AdminCampaignRow`](packages/fe/src/pages/AdminPage.tsx:106) shows title, creator, status, samples count and action buttons. No way to read campaign content, see sample claims, or flag reason without leaving the page.

**Goal:** Allow the admin to quickly review a campaign's key info inline without navigating away.

### Changes needed

- **[`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx)**
  - Add an expand/collapse toggle ("View Details" chevron) to each `AdminCampaignRow`.
  - Expanded panel shows:
    - Campaign description
    - `flagged_reason` (if set)
    - Samples list with claims
    - Funding progress bar
    - Creator username (linked)
    - `amount_requested_usd` vs `funding_threshold_usd`
    - COA status per sample
  - Uses data already present in `CampaignDetailDto` — no new API calls.

---

## 4. User Management Tab (currently backend-only)

**Current state:** `GET /admin/users`, `POST /admin/users/:id/ban`, and `POST /admin/users/:id/claims` all exist in the backend ([`packages/bff/src/controllers/admin.controller.ts:111`](packages/bff/src/controllers/admin.controller.ts:111)) and hooks exist in [`packages/fe/src/api/hooks/useAdmin.ts`](packages/fe/src/api/hooks/useAdmin.ts). But the admin page has **no Users tab**.

**Goal:** Surface basic user management in the UI.

### Changes needed

- **[`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx)**
  - Add "Users" tab.
  - Search box → calls `GET /admin/users?search=`.
  - User list with: email, username, banned status, claims list, created date.
  - Per-user actions: Ban/Unban, Grant/Revoke `admin` or `lab_approver` claim.

- **[`packages/fe/src/api/hooks/useAdmin.ts`](packages/fe/src/api/hooks/useAdmin.ts)**
  - Add `useAdminUsers(search?)` query hook (hook body mirrors the pattern already used).
  - Add `useAdminBanUser()` and `useAdminManageClaim()` mutation hooks.

---

## 5. Flagged Campaigns Badge / Dashboard Summary

**Current state:** No at-a-glance count of flagged campaigns or items needing attention.

**Goal:** Show quick stats at the top of the admin dashboard so the admin knows what needs action.

### Changes needed

- **[`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx)**
  - Add a summary row at the top with stat pills:
    - Flagged campaigns count
    - Pending COAs count
    - Active campaigns count
  - Data derived from existing campaign queries (no new endpoints).

---

## 6. Seed — Ensure Admin Account Always Seeded

**Current state:** Admin account creation was added in [`packages/bff/prisma/seed.ts`](packages/bff/prisma/seed.ts) using `bcryptjs` with a random password printed to stdout on first run. ✅ Done.

**Improvements:**

- Optionally read `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env vars at seed time, so deployments can set credentials declaratively rather than relying on the printed output.
- This removes need to capture seed output in CI/CD pipelines.

### Changes needed

- **[`packages/bff/prisma/seed.ts`](packages/bff/prisma/seed.ts)**
  - Read `process.env.ADMIN_EMAIL` (default `admin@example.com`) and `process.env.ADMIN_PASSWORD` (default: random).
  - If `ADMIN_PASSWORD` is provided, hash and use it; otherwise generate random and print.

- **[`packages/bff/.env.example`](packages/bff/.env.example)**
  - Document `ADMIN_EMAIL` and `ADMIN_PASSWORD` as optional seed-time vars.

---

## Summary of All Changes

```
packages/
  bff/
    prisma/
      seed.ts           — ADMIN_EMAIL/ADMIN_PASSWORD env overrides
    .env.example        — document new seed env vars
  fe/
    src/
      pages/
        AdminPage.tsx   — inline config editing, "Mark Reviewed" label,
                          campaign quick-view panel, users tab, dashboard summary
      api/
        hooks/
          useAdmin.ts   — useAdminUsers, useAdminBanUser, useAdminManageClaim hooks
```

---

## Priority Order

1. **Rename "Unflag" → "Mark Reviewed"** — small, high-signal UX win, zero backend risk
2. **Campaign Quick View** — reduces friction for the most common admin task
3. **Config Inline Editing** — unlocks runtime config changes without dev involvement
4. **Dashboard Summary Counts** — orientation at a glance
5. **Users Tab** — enables ban/claims management from UI
6. **Seed env-var overrides** — deployment QoL
