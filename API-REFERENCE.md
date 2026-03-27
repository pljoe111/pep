# API Reference — sol_pep_funding BFF

> **Purpose:** This document is the single source of truth for building a frontend against the BFF (Backend-for-Frontend) REST API. Every endpoint, request body, query parameter, and response shape is described here. All responses are JSON unless noted.

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Shared Types & Enums](#2-shared-types--enums)
3. [Shared Response Shapes](#3-shared-response-shapes)
4. [Auth](#4-auth)
5. [App Info](#5-app-info)
6. [Wallet](#6-wallet)
7. [Campaigns](#7-campaigns)
8. [Users](#8-users)
9. [Notifications](#9-notifications)
10. [Labs](#10-labs)
11. [Tests (Catalog)](#11-tests-catalog)
12. [Leaderboard](#12-leaderboard)
13. [Admin](#13-admin)

---

## 1. Global Conventions

| Convention           | Detail                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Base URL**         | `http(s)://<host>/api` (all routes below are relative to this)                               |
| **Auth header**      | `Authorization: Bearer <accessToken>`                                                        |
| **Content-Type**     | `application/json` (except COA upload which is `multipart/form-data`)                        |
| **Dates**            | ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`)                                                |
| **Currency amounts** | Always `number` (float), denominated in USD unless the field name says otherwise             |
| **Pagination**       | `?page=1&limit=20` — responses wrap data in [`PaginatedResponseDto`](#paginatedresponsedtot) |
| **JWT**              | Short-lived access token; refresh with `/auth/refresh`.                                      |
| **🔒 Protected**     | Routes marked 🔒 require `Authorization: Bearer <accessToken>`.                              |
| **🛡️ Admin only**    | Routes marked 🛡️ additionally require the `admin` JWT claim.                                 |

### HTTP Status Codes Used

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | Success                         |
| 201  | Created                         |
| 204  | No Content (body is empty)      |
| 400  | Validation error                |
| 401  | Missing or invalid JWT          |
| 403  | Forbidden (insufficient claims) |
| 404  | Resource not found              |
| 409  | Conflict (e.g. duplicate email) |
| 422  | Business rule violation         |
| 500  | Internal server error           |

---

## 2. Shared Types & Enums

### CampaignStatus

```
'created' | 'funded' | 'samples_sent' | 'results_published' | 'resolved' | 'refunded'
```

### ReactionType

```
'thumbs_up' | 'rocket' | 'praising_hands' | 'mad' | 'fire'
```

### VerificationStatus (CoA)

```
'pending' | 'code_found' | 'code_not_found' | 'manually_approved' | 'rejected'
```

### ClaimKind (Sample)

```
'mass' | 'other'
```

### Currency

```
'usdc' | 'usdt'
```

### TransactionType

```
'deposit' | 'withdrawal' | 'contribution' | 'refund' | 'payout' | 'fee'
```

### TxStatus

```
'completed' | 'pending' | 'confirmed' | 'failed'
```

### AccountType

```
'user' | 'campaign' | 'master' | 'fee' | 'external'
```

### ClaimType (User Permissions)

```
'campaign_creator' | 'contributor' | 'lab_approver' | 'admin'
```

### NotificationType

```
'campaign_funded' | 'campaign_locked' | 'samples_shipped' | 'coa_uploaded' |
'campaign_resolved' | 'campaign_refunded' | 'deposit_confirmed' |
'withdrawal_sent' | 'withdrawal_failed'
```

---

## 3. Shared Response Shapes

### `PaginatedResponseDto<T>`

Returned by all list endpoints that accept `page` / `limit`.

```json
{
  "data": [
    /* array of T */
  ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

### `UserDto`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "alice" | null,
  "is_banned": false,
  "email_verified": true,
  "claims": ["campaign_creator", "contributor"],
  "stats": {
    "total_contributed_usd": 150.00,
    "campaigns_created": 3,
    "campaigns_successful": 2,
    "campaigns_refunded": 0
  },
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

### `CoaDto`

```json
{
  "id": "uuid",
  "sample_id": "uuid",
  "file_url": "https://s3.../signed-url",
  "file_name": "lab-report.pdf",
  "file_size_bytes": 204800,
  "uploaded_at": "2025-06-01T00:00:00.000Z",
  "verification_status": "pending",
  "verification_notes": null,
  "verified_at": null
}
```

### `CampaignDetailDto`

```json
{
  "id": "uuid",
  "title": "Test My Protein Powder",
  "description": "Full markdown description…",
  "status": "created",
  "creator": {
    "id": "uuid",
    "username": "alice",
    "successful_campaigns": 2
  },
  "verification_code": 4829,
  "amount_requested_usd": 500.00,
  "estimated_lab_cost_usd": 420.00,
  "current_funding_usd": 125.00,
  "funding_threshold_usd": 350.00,
  "funding_threshold_percent": 70,
  "funding_progress_percent": 35.71,
  "platform_fee_percent": 5,
  "is_flagged_for_review": false,
  "flagged_reason": null,
  "is_itemized": false,
  "itemization_data": null,
  "samples": [ /* SampleDto[] */ ],
  "updates": [ /* CampaignUpdateDto[] */ ],
  "reactions": {
    "thumbs_up": 12,
    "rocket": 5,
    "praising_hands": 3,
    "mad": 0,
    "fire": 7
  },
  "my_reaction": null,
  "deadlines": {
    "fundraising": "2025-07-01T00:00:00.000Z" | null,
    "ship_samples": null,
    "publish_results": null
  },
  "timestamps": {
    "created_at": "2025-06-01T00:00:00.000Z",
    "funded_at": null,
    "locked_at": null,
    "samples_sent_at": null,
    "results_published_at": null,
    "resolved_at": null,
    "refunded_at": null
  },
  "refund_reason": null
}
```

### `SampleDto`

```json
{
  "id": "uuid",
  "vendor_name": "BulkSupplements",
  "purchase_date": "2025-05-15",
  "physical_description": "White powder, unflavored",
  "sample_label": "Sample A",
  "order_index": 0,
  "target_lab": { "id": "uuid", "name": "Informed Sport" },
  "claims": [
    {
      "id": "uuid",
      "claim_type": "mass",
      "mass_amount": 100,
      "mass_unit": "g",
      "other_description": null
    }
  ],
  "tests": [
    {
      "id": "uuid",
      "test_id": "uuid",
      "name": "Heavy Metals Panel",
      "usp_code": "USP <232>"
    }
  ],
  "coa": null
}
```

### `CampaignUpdateDto`

```json
{
  "id": "uuid",
  "campaign_id": "uuid",
  "author_id": "uuid",
  "content": "Samples have shipped!",
  "update_type": "text",
  "state_change_from": null,
  "state_change_to": null,
  "created_at": "2025-06-10T00:00:00.000Z"
}
```

---

## 4. Auth

Base path: `/auth`  
All endpoints are public unless marked 🔒.

---

### `POST /auth/register`

Create a new user account. Returns tokens + deposit address.

**Request body:**

```json
{
  "email": "user@example.com", // required, max 255 chars
  "password": "Str0ngPass!", // required, min 8 chars, ≥1 upper, ≥1 lower, ≥1 digit
  "username": "alice_99" // optional, 3–50 chars, [a-zA-Z0-9_] only
}
```

**Response `201`:**

```json
{
  "user": {
    /* UserDto */
  },
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…",
  "depositAddress": "So1ana…base58…"
}
```

---

### `POST /auth/login`

Authenticate with email + password.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "Str0ngPass!"
}
```

**Response `200`:**

```json
{
  "user": {
    /* UserDto */
  },
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…"
}
```

---

### `POST /auth/refresh`

Exchange a valid refresh token for a new token pair.

**Request body:**

```json
{
  "refreshToken": "eyJ…"
}
```

**Response `200`:**

```json
{
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…"
}
```

---

### `POST /auth/logout` 🔒

Invalidates **all** active refresh tokens for the authenticated user.

**Request body:** _(empty)_

**Response `204`:** _(no body)_

---

### `GET /auth/me` 🔒

Returns the full profile of the currently authenticated user.

**Response `200`:** [`UserDto`](#userdto)

---

### `POST /auth/verify-email`

Verify an email address using the token from the verification email.

**Request body:**

```json
{
  "token": "abc123verificationtoken"
}
```

**Response `200`:**

```json
{
  "message": "Email verified successfully"
}
```

---

### `POST /auth/resend-verification` 🔒

Re-send the email verification link to the authenticated user's address.

**Request body:** _(empty)_

**Response `200`:**

```json
{
  "message": "Verification email sent"
}
```

---

## 5. App Info

Base path: `/app-info`  
Public — no authentication required.

---

### `GET /app-info`

Returns global platform configuration needed to bootstrap the UI (Solana network, mint addresses, minimum amounts).

**Response `200`:**

```json
{
  "version": "1.0.0",
  "network": "devnet",
  "usdc_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "usdt_mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "minimums": {
    "min_contribution_usd": 1.0,
    "min_funding_threshold_usd": 50.0,
    "min_funding_threshold_percent": 5,
    "min_withdrawal_usd": 5.0
  }
}
```

---

## 6. Wallet

Base path: `/wallet`  
All wallet endpoints require 🔒 JWT.

---

### `GET /wallet/balance` 🔒

Returns the authenticated user's internal (off-chain ledger) balance.

**Response `200`:**

```json
{
  "balance_usdc": 250.0,
  "balance_usdt": 0.0
}
```

---

### `GET /wallet/deposit-address` 🔒

Returns the user's unique on-chain Solana deposit address.

**Response `200`:**

```json
{
  "address": "SoL1na…base58…",
  "qr_hint": "solana:SoL1na…base58…"
}
```

> **UI hint:** Generate a QR code from `qr_hint` using any QR library.

---

### `POST /wallet/withdraw` 🔒

Request a withdrawal from the internal ledger to an external Solana address. Requires email verified. User must not be banned.

**Request body:**

```json
{
  "amount": 50.0, // number, min 0.000001
  "currency": "usdc", // "usdc" | "usdt"
  "destination_address": "SoL…base58" // Solana base58 public key
}
```

**Response `200`:**

```json
{
  "ledger_transaction_id": "uuid",
  "status": "pending"
}
```

> Withdrawal is processed asynchronously. Poll `/wallet/transactions` or listen for the `withdrawal_sent` / `withdrawal_failed` notification.

---

### `GET /wallet/transactions` 🔒

Paginated transaction history for the authenticated user.

**Query parameters:**

| Param   | Type   | Default | Description                 |
| ------- | ------ | ------- | --------------------------- |
| `page`  | number | 1       | Page number                 |
| `limit` | number | 20      | Items per page              |
| `type`  | string | —       | Filter by `TransactionType` |

**Response `200`:** `PaginatedResponseDto<LedgerTransactionDto>`

```json
{
  "data": [
    {
      "id": "uuid",
      "transaction_type": "deposit",
      "amount": 100.0,
      "currency": "usdc",
      "from_account_type": "external",
      "to_account_type": "user",
      "status": "completed",
      "onchain_signature": "5Hx…signature",
      "created_at": "2025-06-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## 7. Campaigns

Base path: `/campaigns`

---

### `GET /campaigns` (public)

List all public campaigns with pagination and optional filters.

**Query parameters:**

| Param    | Type             | Default | Description                                                |
| -------- | ---------------- | ------- | ---------------------------------------------------------- |
| `status` | `CampaignStatus` | —       | Filter by status                                           |
| `search` | string           | —       | Full-text search on title/description                      |
| `sort`   | string           | —       | Sort field (e.g. `created_at`, `funding_progress_percent`) |
| `page`   | number           | 1       | Page number                                                |
| `limit`  | number           | 20      | Items per page                                             |

**Response `200`:** `PaginatedResponseDto<CampaignListDto>`

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Test My Creatine",
      "status": "created",
      "creator": { "id": "uuid", "username": "alice" },
      "amount_requested_usd": 500.0,
      "current_funding_usd": 125.0,
      "funding_threshold_usd": 350.0,
      "funding_progress_percent": 35.71,
      "is_flagged_for_review": false,
      "is_hidden": false,
      "sample_labels": ["Sample A", "Sample B"],
      "deadline_fundraising": "2025-07-01T00:00:00.000Z",
      "time_remaining_seconds": 1296000,
      "created_at": "2025-06-01T00:00:00.000Z"
    }
  ],
  "total": 80,
  "page": 1,
  "limit": 20
}
```

---

### `POST /campaigns` 🔒

Create a new campaign. Requires the `campaign_creator` JWT claim.

**Request body:**

```json
{
  "title": "Test My Protein Powder",
  "description": "Detailed markdown description of what I want tested and why.",
  "amount_requested_usd": 500.0, // min 0.01
  "funding_threshold_percent": 70, // integer 5–100
  "is_itemized": false, // optional
  "itemization_data": null, // optional, free JSON
  "samples": [
    {
      "vendor_name": "BulkSupplements",
      "purchase_date": "2025-05-15", // YYYY-MM-DD
      "physical_description": "White powder, unflavored",
      "sample_label": "Sample A",
      "target_lab_id": "uuid",
      "order_index": 0, // optional
      "claims": [
        {
          "claim_type": "mass", // "mass" | "other"
          "mass_amount": 100, // required if claim_type = "mass"
          "mass_unit": "g", // required if claim_type = "mass"
          "other_description": null // required if claim_type = "other"
        }
      ],
      "tests": [{ "test_id": "uuid" }]
    }
  ]
}
```

**Response `201`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `GET /campaigns/estimate-cost` 🔒

Preview the estimated lab cost for a given set of samples (before creating the campaign).

**Query parameters:**

| Param     | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| `samples` | string | ✅       | JSON-encoded array of sample/test pairs |

**Response `200`:**

```json
{
  "estimated_usd": 420.0,
  "breakdown": [
    {
      "lab_id": "uuid",
      "lab_name": "Informed Sport",
      "test_id": "uuid",
      "test_name": "Heavy Metals Panel",
      "price_usd": 140.0
    }
  ]
}
```

---

### `GET /campaigns/verification-code` 🔒

Generate a short numeric verification code that the creator embeds in product descriptions to prove ownership. Rate-limited to 5 req/min per user.

**Response `200`:**

```json
{
  "code": 4829
}
```

---

### `GET /campaigns/me` 🔒

List campaigns created by the authenticated user.

**Query parameters:**

| Param    | Type             | Default | Description      |
| -------- | ---------------- | ------- | ---------------- |
| `page`   | number           | 1       | Page number      |
| `limit`  | number           | 20      | Items per page   |
| `status` | `CampaignStatus` | —       | Filter by status |

**Response `200`:** `PaginatedResponseDto<CampaignListDto>`

---

### `GET /campaigns/:id` (public)

Get full campaign details. If a valid JWT is provided, `my_reaction` will be populated.

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `PATCH /campaigns/:id` 🔒

Update a campaign. Only the owner can update; only allowed while `status = 'created'`.

**Request body** _(all fields optional)_:

```json
{
  "title": "Updated Title",
  "description": "Updated description.",
  "is_itemized": true,
  "itemization_data": { "key": "value" }
}
```

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `DELETE /campaigns/:id` 🔒

Delete a campaign. Only the owner can delete. Allowed only before funding.

**Response `204`:** _(no body)_

---

### `POST /campaigns/:id/lock` 🔒

Lock the campaign for fundraising. Transitions `created → funded` (initiates the fundraising deadline). Only the owner.

**Request body:** _(empty)_

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `POST /campaigns/:id/ship-samples` 🔒

Mark that samples have been shipped to the lab. Transitions `funded → samples_sent`. Only the owner.

**Request body:** _(empty)_

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `GET /campaigns/:id/updates` (public)

Get paginated campaign creator updates (text posts and state-change events).

**Query parameters:**

| Param   | Type   | Default |
| ------- | ------ | ------- |
| `page`  | number | 1       |
| `limit` | number | 20      |

**Response `200`:** `PaginatedResponseDto<CampaignUpdateDto>`

---

### `POST /campaigns/:id/updates` 🔒

Post a text update to a campaign. Only the owner.

**Request body:**

```json
{
  "content": "We shipped the samples today!"
}
```

**Response `200`:** [`CampaignUpdateDto`](#campaignupdatedto)

---

### `GET /campaigns/:id/coas` (public)

Get all Certificates of Analysis (CoA) for a campaign.

**Response `200`:** `CoaDto[]`

---

### `POST /campaigns/:id/samples/:sampleId/coa` 🔒

Upload a CoA PDF for a specific sample. Multipart form-data. Only the owner.

**Request:** `multipart/form-data`

- Field `file` — PDF file

**Response `200`:** [`CoaDto`](#coadto)

---

### `GET /campaigns/:id/contributions` 🔒

Get paginated list of contributions to a campaign. Available to the campaign owner or admin.

**Query parameters:**

| Param   | Type   | Default |
| ------- | ------ | ------- |
| `page`  | number | 1       |
| `limit` | number | 20      |

**Response `200`:** `PaginatedResponseDto<ContributionDto>`

```json
{
  "data": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "campaign_title": "Test My Protein Powder",
      "contributor": { "id": "uuid", "username": "bob" },
      "amount_usd": 25.0,
      "currency": "usdc",
      "status": "completed",
      "contributed_at": "2025-06-05T12:00:00.000Z",
      "refunded_at": null
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 20
}
```

---

### `POST /campaigns/:id/contribute` 🔒

Contribute funds to a campaign from the user's internal wallet balance. Requires email verified. User must not be banned.

**Request body:**

```json
{
  "amount": 25.0, // number, min 0.000001 (platform min enforced server-side)
  "currency": "usdc" // "usdc" | "usdt"
}
```

**Response `200`:** `ContributionDto`

---

### `GET /campaigns/:id/reactions` (public)

Get reaction counts for a campaign.

**Response `200`:**

```json
{
  "thumbs_up": 12,
  "rocket": 5,
  "praising_hands": 3,
  "mad": 0,
  "fire": 7
}
```

---

### `POST /campaigns/:id/reactions` 🔒

Add or overwrite the authenticated user's reaction.

**Request body:**

```json
{
  "reaction_type": "rocket" // "thumbs_up" | "rocket" | "praising_hands" | "mad" | "fire"
}
```

**Response `200`:**

```json
{
  "reaction_type": "rocket",
  "created_at": "2025-06-05T12:00:00.000Z"
}
```

---

### `DELETE /campaigns/:id/reactions/:type` 🔒

Remove the authenticated user's reaction of the given type.

**Path params:** `type` — one of `ReactionType`

**Response `204`:** _(no body)_

---

## 8. Users

Base path: `/users`

---

### `GET /users/me` 🔒

Return the authenticated user's profile. (Equivalent to `GET /auth/me`.)

**Response `200`:** [`UserDto`](#userdto)

---

### `PATCH /users/me` 🔒

Update the authenticated user's public username.

**Request body** _(all fields optional)_:

```json
{
  "username": "new_username" // 3–50 chars, [a-zA-Z0-9_] only
}
```

**Response `200`:** [`UserDto`](#userdto)

---

### `PATCH /users/me/notification-preferences` 🔒

Configure per-event notification preferences (email and in-app toggles).

**Request body** _(all fields optional — omit to leave unchanged)_:

```json
{
  "campaign_funded": { "email": true, "in_app": true },
  "campaign_locked": { "email": true, "in_app": true },
  "samples_shipped": { "email": true, "in_app": true },
  "coa_uploaded": { "email": false, "in_app": true },
  "campaign_refunded": { "email": true, "in_app": true },
  "campaign_resolved": { "email": true, "in_app": true },
  "deposit_confirmed": { "email": false, "in_app": true },
  "withdrawal_sent": { "email": true, "in_app": true },
  "withdrawal_failed": { "email": true, "in_app": true }
}
```

**Response `200`:** [`UserDto`](#userdto)

---

### `GET /users/:id/profile` (public)

Get the public profile of any user by their ID.

**Response `200`:**

```json
{
  "id": "uuid",
  "username": "alice",
  "stats": {
    "total_contributed_usd": 500.0,
    "campaigns_created": 3,
    "campaigns_successful": 2
  },
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

---

## 9. Notifications

Base path: `/notifications`  
All notification endpoints require 🔒 JWT.

---

### `GET /notifications` 🔒

Get the authenticated user's paginated notification feed.

**Query parameters:**

| Param   | Type   | Default |
| ------- | ------ | ------- |
| `page`  | number | 1       |
| `limit` | number | 20      |

**Response `200`:** `PaginatedResponseDto<NotificationDto>`

```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "notification_type": "campaign_funded",
      "campaign_id": "uuid",
      "title": "Campaign Funded!",
      "message": "Your campaign 'Test My Creatine' has been fully funded.",
      "is_read": false,
      "sent_email": true,
      "created_at": "2025-06-05T12:00:00.000Z",
      "read_at": null
    }
  ],
  "total": 7,
  "page": 1,
  "limit": 20
}
```

---

### `GET /notifications/unread-count` 🔒

Get the number of unread notifications for the authenticated user.

**Response `200`:**

```json
{
  "count": 3
}
```

---

### `PATCH /notifications/:id/read` 🔒

Mark a single notification as read.

**Response `200`:** `NotificationDto` _(with `is_read: true` and `read_at` set)_

---

### `PATCH /notifications/read-all` 🔒

Mark all unread notifications as read.

**Response `200`:**

```json
{
  "marked_count": 3
}
```

---

## 10. Labs

Base path: `/labs`

---

### `GET /labs` (public)

List all labs, optionally filtering to approved labs only.

**Query parameters:**

| Param           | Type    | Default | Description                             |
| --------------- | ------- | ------- | --------------------------------------- |
| `approved_only` | boolean | false   | When `true`, returns only approved labs |
| `page`          | number  | 1       | Page number                             |
| `limit`         | number  | 20      | Items per page                          |

**Response `200`:** `PaginatedResponseDto<LabDto>`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Informed Sport",
      "phone_number": "+1-800-555-0199",
      "country": "US",
      "address": "123 Lab Ave, Austin, TX",
      "is_approved": true,
      "approved_at": "2025-01-15T00:00:00.000Z",
      "created_at": "2025-01-10T00:00:00.000Z"
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

---

### `GET /labs/:id` (public)

Get a single lab's details including its test menu.

**Response `200`:** `LabDetailDto`

```json
{
  "id": "uuid",
  "name": "Informed Sport",
  "phone_number": "+1-800-555-0199",
  "country": "US",
  "address": "123 Lab Ave, Austin, TX",
  "is_approved": true,
  "approved_at": "2025-01-15T00:00:00.000Z",
  "created_at": "2025-01-10T00:00:00.000Z",
  "tests": [
    {
      "id": "uuid",
      "lab_id": "uuid",
      "test_id": "uuid",
      "test_name": "Heavy Metals Panel",
      "price_usd": 140.0,
      "typical_turnaround_days": 14
    }
  ]
}
```

---

### `POST /labs` 🔒

Create a new lab. Requires the `lab_approver` JWT claim.

**Request body:**

```json
{
  "name": "LabCorp Nutritional", // required
  "country": "US", // required
  "phone_number": "+1-555-000-1234", // optional
  "address": "456 Science Blvd, Boston" // optional
}
```

**Response `200`:** `LabDto`

---

### `PATCH /labs/:id` 🔒

Update a lab's information. Requires the `lab_approver` claim.

**Request body** _(all fields optional)_:

```json
{
  "name": "Updated Lab Name",
  "phone_number": "+1-555-000-9999",
  "country": "CA",
  "address": "789 Research Rd, Toronto"
}
```

**Response `200`:** `LabDto`

---

### `POST /labs/:id/approve` 🔒

Approve a lab, making it available for campaign creators to select. Requires the `lab_approver` claim.

**Request body:** _(empty)_

**Response `200`:** `LabDto` _(with `is_approved: true`)_

---

### `POST /labs/:id/tests` 🔒

Add a test to a lab's menu at a given price. Requires the `lab_approver` claim.

**Request body:**

```json
{
  "test_id": "uuid", // must reference an existing TestDto
  "price_usd": 140.0, // min 0.01
  "typical_turnaround_days": 14 // positive integer
}
```

**Response `200`:** `LabTestDto`

```json
{
  "id": "uuid",
  "lab_id": "uuid",
  "test_id": "uuid",
  "test_name": "Heavy Metals Panel",
  "price_usd": 140.0,
  "typical_turnaround_days": 14
}
```

---

### `PATCH /labs/:id/tests/:testId` 🔒

Update an existing test entry in a lab's menu. Requires the `lab_approver` claim.

**Request body** _(all fields optional)_:

```json
{
  "price_usd": 160.0,
  "typical_turnaround_days": 10,
  "change_reason": "Price adjustment Q3 2025"
}
```

**Response `200`:** `LabTestDto`

---

## 11. Tests (Catalog)

Base path: `/tests`  
The test catalog is the global list of available test types. Labs link to tests via `LabTestDto`.

---

### `GET /tests` (public)

List all test types, optionally filtered to active only.

**Query parameters:**

| Param         | Type    | Default | Description                             |
| ------------- | ------- | ------- | --------------------------------------- |
| `active_only` | boolean | false   | When `true`, excludes deactivated tests |

**Response `200`:** `TestDto[]`

```json
[
  {
    "id": "uuid",
    "name": "Heavy Metals Panel",
    "description": "Tests for lead, arsenic, cadmium, mercury per USP <232>.",
    "usp_code": "USP <232>",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /tests` 🔒

Create a new test type. Requires the `admin` JWT claim.

**Request body:**

```json
{
  "name": "Microbiology Screen",
  "description": "Screens for aerobic plate count, yeast, mold.",
  "usp_code": "USP <61>" // optional
}
```

**Response `200`:** `TestDto`

---

### `PATCH /tests/:id` 🔒

Update an existing test type. Requires the `admin` JWT claim.

**Request body** _(all fields optional)_:

```json
{
  "name": "Updated Test Name",
  "description": "Updated description.",
  "usp_code": "USP <62>",
  "is_active": false // deactivate / reactivate
}
```

**Response `200`:** `TestDto`

---

## 12. Leaderboard

Base path: `/leaderboard`  
Public — no authentication required.

---

### `GET /leaderboard/contributors`

Top contributors ranked by total USD contributed.

**Query parameters:**

| Param    | Type                   | Default | Description          |
| -------- | ---------------------- | ------- | -------------------- |
| `period` | `'all'` \| `'monthly'` | `'all'` | Time window          |
| `limit`  | number                 | 10      | Max entries returned |

**Response `200`:** `LeaderboardEntryDto[]`

```json
[
  {
    "rank": 1,
    "user": { "id": "uuid", "username": "bigspender" },
    "value": 1500.0,
    "period": "all"
  }
]
```

> `value` = total USD contributed for the period.

---

### `GET /leaderboard/creators`

Top campaign creators ranked by number of successfully resolved campaigns.

**Query parameters:**

| Param    | Type                   | Default | Description          |
| -------- | ---------------------- | ------- | -------------------- |
| `period` | `'all'` \| `'monthly'` | `'all'` | Time window          |
| `limit`  | number                 | 10      | Max entries returned |

**Response `200`:** `LeaderboardEntryDto[]`

> `value` = number of successfully resolved campaigns for the period.

---

## 13. Admin

Base path: `/admin`  
All admin endpoints require 🔒 JWT **and** the `admin` claim (🛡️).

---

### `GET /admin/campaigns` 🛡️

Get all campaigns with admin-level visibility (includes hidden and flagged).

**Query parameters:**

| Param     | Type             | Description                      |
| --------- | ---------------- | -------------------------------- |
| `status`  | `CampaignStatus` | Filter by status                 |
| `flagged` | boolean          | Filter to only flagged campaigns |
| `page`    | number           | Page number                      |
| `limit`   | number           | Items per page                   |

**Response `200`:** `PaginatedResponseDto<CampaignDetailDto>`

---

### `POST /admin/campaigns/:id/refund` 🛡️

Force-refund all contributions on a campaign and move it to `refunded` status.

**Request body:**

```json
{
  "reason": "Creator violated terms of service."
}
```

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `POST /admin/campaigns/:id/hide` 🛡️

Show or hide a campaign from the public listing.

**Request body:**

```json
{
  "hidden": true // true = hide, false = unhide
}
```

**Response `200`:** [`CampaignDetailDto`](#campaigndetaildto)

---

### `POST /admin/coas/:id/verify` 🛡️

Approve or reject a Certificate of Analysis (CoA) document uploaded by a campaign creator.

**Request body:**

```json
{
  "status": "approved", // "approved" | "rejected"
  "notes": "Code found on page 3." // optional
}
```

**Response `200`:** [`CoaDto`](#coadto) _(with updated `verification_status`)_

---

### `POST /admin/users/:id/ban` 🛡️

Ban or unban a user.

**Request body:**

```json
{
  "banned": true,
  "reason": "Multiple TOS violations." // optional
}
```

**Response `200`:** [`UserDto`](#userdto)

---

### `POST /admin/users/:id/claims` 🛡️

Grant or revoke a permission claim for a user.

**Request body:**

```json
{
  "claim_type": "campaign_creator", // "campaign_creator" | "contributor" | "lab_approver" | "admin"
  "action": "grant" // "grant" | "revoke"
}
```

**Response `200`:** [`UserDto`](#userdto) _(with updated `claims` array)_

---

### `GET /admin/config` 🛡️

Get all platform configuration key-value pairs.

**Response `200`:** `ConfigurationDto[]`

```json
[
  {
    "id": "uuid",
    "config_key": "global_minimums",
    "config_value": {
      "min_contribution_usd": 1.0,
      "min_funding_threshold_usd": 50.0,
      "min_funding_threshold_percent": 5,
      "min_withdrawal_usd": 5.0
    },
    "description": "Global minimum amounts enforced on transactions.",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `PUT /admin/config/:key` 🛡️

Update a configuration value by its key.

**Path params:** `key` — the `config_key` string (e.g. `global_minimums`)

**Request body:**

```json
{
  "value": {
    "min_contribution_usd": 2.0,
    "min_funding_threshold_usd": 100.0,
    "min_funding_threshold_percent": 10,
    "min_withdrawal_usd": 10.0
  }
}
```

**Response `200`:** `ConfigurationDto`

---

### `POST /admin/fee-sweep` 🛡️

Transfer accumulated platform fees from the fee ledger account to an external Solana wallet.

**Request body:**

```json
{
  "destination_address": "SoL…base58",
  "currency": "usdc" // "usdc" | "usdt"
}
```

**Response `200`:**

```json
{
  "ledger_transaction_id": "uuid"
}
```

---

## Appendix — Campaign Lifecycle State Machine

```
created ──lock()──► funded ──ship-samples()──► samples_sent
                                                    │
                              (lab uploads results via CoA)
                                                    ▼
                                           results_published
                                                    │
                                             (admin resolves)
                                                    ▼
                                               resolved

Any state ──admin force-refund──► refunded
```

| Transition                         | Trigger                            | Actor          |
| ---------------------------------- | ---------------------------------- | -------------- |
| `created → funded`                 | `POST /campaigns/:id/lock`         | Campaign owner |
| `funded → samples_sent`            | `POST /campaigns/:id/ship-samples` | Campaign owner |
| `samples_sent → results_published` | CoA upload + verification          | Lab / Admin    |
| `results_published → resolved`     | Admin action                       | Admin          |
| Any → `refunded`                   | Admin force-refund                 | Admin          |

---

## Appendix — Key Frontend Flows

### Registration & Onboarding

1. `GET /app-info` — load minimums and network config.
2. `POST /auth/register` — create account → receive tokens + `depositAddress`.
3. Show deposit QR: `GET /wallet/deposit-address` → display `qr_hint`.
4. `POST /auth/verify-email` with token from email link.

### Browse & Contribute

1. `GET /campaigns` — list campaigns with filters.
2. `GET /campaigns/:id` — campaign detail page.
3. `GET /campaigns/:id/reactions` — show reaction bar.
4. `POST /campaigns/:id/reactions` — react.
5. `GET /wallet/balance` — show user balance before contributing.
6. `POST /campaigns/:id/contribute` — submit contribution.

### Create a Campaign

1. `GET /tests?active_only=true` — populate test picker.
2. `GET /labs?approved_only=true` — populate lab picker.
3. `GET /campaigns/verification-code` — get verification code to embed in product listing.
4. `GET /campaigns/estimate-cost?samples=…` — live cost preview.
5. `POST /campaigns` — submit.
6. `PATCH /campaigns/:id` — edit before locking.
7. `POST /campaigns/:id/lock` — start fundraising.

### Notifications

1. Poll `GET /notifications/unread-count` on a timer (or WebSocket if implemented).
2. `GET /notifications` — notification feed.
3. `PATCH /notifications/:id/read` or `PATCH /notifications/read-all`.

### Wallet Management

1. `GET /wallet/balance` — current balances.
2. `GET /wallet/deposit-address` — deposit QR.
3. `POST /wallet/withdraw` — initiate withdrawal.
4. `GET /wallet/transactions` — transaction history.
