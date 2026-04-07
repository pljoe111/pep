# Campaign Feature Description

> **Scope:** Everything that touches a Campaign — creation wizard, state machine, funding, samples, COA flow, resolution/refund, and admin controls.

---

## 1. What Is It

A **Campaign** is the core entity of PepLab. It is a community-funded lab-testing initiative created by a user (the **campaign creator**) who wants a physical product (typically a peptide supplement) independently tested by a certified third-party lab.

The flow in plain terms:

1. A creator submits a campaign describing what they have, what they want professionally tested, and how much money they need to pay for it.
2. Community members browse campaigns and **contribute** from their PepLab wallet balance.
3. Once the creator is satisfied with funding, they **lock** the campaign (closing new contributions), then physically **ship** their samples to the chosen lab.
4. The lab analyses the samples. The creator uploads the lab's **Certificate of Analysis (COA)** PDF for each sample.
5. An admin **reviews and approves** each COA manually.
6. Once every COA is approved the campaign moves to _results published_. An admin then approves the resolution.
7. The creator receives a **payout** (escrow balance minus platform fee). Contributors keep the test results as proof forever.

If anything goes wrong at any stage an admin (or the auto-refund system) can **refund** all contributors — reversing every ledger move atomically.

---

## 2. Lifecycle

### 2.1 Status State Machine

```
 ┌──────────┐     lock()      ┌────────┐   ship-samples()  ┌──────────────┐
 │ created  │ ──────────────► │ funded │ ────────────────► │ samples_sent │
 └──────────┘                 └────────┘                    └──────────────┘
      │                            │                               │
      │                            │                               │ all COAs manually_approved
      │                            │                               ▼
      │                            │                    ┌────────────────────┐
      │                            │                    │ results_published  │
      │                            │                    └────────────────────┘
      │                            │                               │
      │                            │                               │ admin approves resolution
      │                            │                               ▼
      │                            │                         ┌──────────┐
      │                            │                         │ resolved │
      │                            │                         └──────────┘
      │                            │
      └─────────────────────────── ┴──── (any non-terminal status)
                                           │
                                           │ admin force-refund  OR
                                           │ 3-strikes COA auto-refund
                                           ▼
                                      ┌──────────┐
                                      │ refunded │
                                      └──────────┘
```

### 2.2 Transition Rules

| From                | To                  | Trigger                                                                                                                  | Guards                                                                                          |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `created`           | `funded`            | Creator calls `POST /campaigns/:id/lock`                                                                                 | `current_funding_usd ≥ effective_lock_threshold_usd` AND campaign is **not** flagged for review |
| `funded`            | `samples_sent`      | Creator calls `POST /campaigns/:id/ship-samples`                                                                         | Campaign must still be in `funded` status                                                       |
| `samples_sent`      | `results_published` | Automatic — triggered inside `CoaService` when the last pending COA for the campaign receives `manually_approved` status | All samples must have a COA; every COA must be `manually_approved`                              |
| `results_published` | `resolved`          | Admin approves resolution via `POST /admin/campaigns/:id/resolve`                                                        | Must be in `results_published`                                                                  |
| _any non-terminal_  | `refunded`          | Admin `POST /admin/campaigns/:id/refund` (requires reason) OR auto-refund after 3 COA rejections on any sample           | Cannot refund an already `resolved` or `refunded` campaign                                      |

### 2.3 Deadlines

Deadlines are set progressively — each transition creates the next window:

| Deadline field             | Set when                                         | Value                       |
| -------------------------- | ------------------------------------------------ | --------------------------- |
| `deadline_fundraising`     | Campaign created                                 | `created_at + 14 days`      |
| `deadline_ship_samples`    | Campaign locked (`created → funded`)             | `funded_at + 7 days`        |
| `deadline_publish_results` | Samples marked shipped (`funded → samples_sent`) | `samples_sent_at + 21 days` |

> Deadlines are informational and displayed to users. They do not currently trigger automatic state changes — a background job ([`deadline-monitor.job.ts`](packages/bff/src/jobs/deadline-monitor.job.ts)) exists for future enforcement.

### 2.4 Auto-Flag on Creation

New campaigns are automatically flagged for admin review (`is_flagged_for_review = true`) if either condition is true:

- The creator has **zero** previously resolved campaigns (new/unproven creator).
- The `amount_requested_usd` exceeds the platform `auto_flag_threshold_usd` config value.

A flagged campaign **cannot be locked** by the creator until an admin clears the flag.

### 2.5 Effective Lock Threshold

The threshold required to lock is whichever is **lower**: the campaign's own `funding_threshold_usd` or the platform's global `min_funding_threshold_usd`. This ensures a creator can always lock once they've met the platform minimum, even if their personal threshold is higher.

```
effective_lock_threshold = min(campaign.funding_threshold_usd, global_minimums.min_funding_threshold_usd)
```

### 2.6 Payout on Resolution (Serializable transaction)

When resolved, the escrow balance is split:

```
fee    = escrow_balance × platform_fee_percent / 100  (rounded DOWN to 6 decimal places)
payout = escrow_balance − fee
```

- `payout` credited to creator's `LedgerAccount`
- `fee` credited to `FeeAccount`
- Both legs recorded as separate `LedgerTransaction` rows (type `payout` + `fee`)
- All in a `SERIALIZABLE` transaction

### 2.7 COA Review & 3-Strikes Auto-Refund

Each sample requires exactly one COA PDF uploaded by the creator. Admins review every COA:

| COA Status          | Meaning                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `pending`           | Uploaded; OCR may still be running                                                 |
| `code_found`        | OCR detected the verification code — informational only, does NOT advance campaign |
| `code_not_found`    | OCR could not find code — admin still reviews manually; re-upload allowed          |
| `manually_approved` | Admin explicitly approved — counts toward campaign advancement                     |
| `rejected`          | Admin rejected — creator must re-upload; increments `coa.rejection_count`          |

**3-strikes rule:** Each manual rejection increments the `rejection_count` on that COA row. When it reaches **3**, the campaign is automatically force-refunded via the same `refundContributions` path as an admin refund.

---

## 3. Data Required

### 3.1 Campaign (Creator-Supplied, `CreateCampaignDto`)

| Field                       | Type               | Constraints                                                   | Description                                                                                                                                                                   |
| --------------------------- | ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                     | `string`           | Required, max 200 chars                                       | Public-facing campaign name. Displayed in the feed, detail page, and admin panel.                                                                                             |
| `description`               | `string`           | Required, non-empty                                           | Full description of what is being tested, why, and any context contributors should know. Rendered with whitespace preserved.                                                  |
| `amount_requested_usd`      | `number`           | Required, min `0.01`, must be ≤ 1.5× `estimated_lab_cost_usd` | Total USD the creator wants to raise. The multiplier guard prevents wildly inflated asks.                                                                                     |
| `funding_threshold_percent` | `integer`          | Required, 5–100 (inclusive). Default 70 in wizard             | The percentage of `amount_requested_usd` the campaign must reach before the creator can lock it. Stored as both a percent and a computed USD value (`funding_threshold_usd`). |
| `is_itemized`               | `boolean`          | Optional, defaults `false`                                    | Whether the creator provides a structured cost breakdown alongside the description. Enables a "Cost Breakdown" panel on the detail page.                                      |
| `itemization_data`          | `unknown` (JSON)   | Optional, present when `is_itemized=true`                     | Arbitrary JSON cost breakdown. Shape is not validated by the backend; rendered by the frontend as provided.                                                                   |
| `samples`                   | `SampleInputDto[]` | Required, min 1 item                                          | The physical samples that will be shipped to labs. See §3.2.                                                                                                                  |

### 3.2 Sample (`SampleInputDto`)

One entry per physical product vial/package being tested. A campaign can have multiple samples going to different labs.

| Field                  | Type                        | Constraints                    | Description                                                                                                                                                                 |
| ---------------------- | --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vendor_name`          | `string`                    | Required, non-empty            | Free-text name of the vendor/seller. Always stored; used for display even if a registry vendor is selected.                                                                 |
| `vendor_id`            | `UUID`                      | Optional                       | Foreign key to an approved `Vendor` in the registry. Nullable — many vendors have not been submitted or approved yet.                                                       |
| `peptide_id`           | `UUID`                      | Optional                       | Foreign key to an approved `Peptide` in the catalog. Nullable — enables identity claims and clean display.                                                                  |
| `purchase_date`        | `string` (ISO `YYYY-MM-DD`) | Required, must be a valid date | When the creator purchased the product. Provides a provenance timestamp for the test record.                                                                                |
| `physical_description` | `string`                    | Optional                       | Observable characteristics (e.g. _"white powder, gray capsules, unflavoured"_). Helps contributors correlate the COA with the product they know.                            |
| `sample_label`         | `string`                    | Required, max 200 chars        | Short identifier for the sample within this campaign (e.g. _"BPC-157 from Peptide Sciences"_). Auto-generated by the wizard from `peptide.name + vendor.name` but editable. |
| `target_lab_id`        | `UUID`                      | Required                       | The approved lab (`Lab.is_approved=true`) that will receive and test this sample. Must already exist in the lab registry.                                                   |
| `order_index`          | `integer`                   | Optional, min 0, defaults 0    | Display order among a campaign's samples.                                                                                                                                   |
| `claims`               | `SampleClaimInputDto[]`     | Required, min 1 item           | Assertions the creator makes about the sample (e.g. "this is 98% pure BPC-157"). Informational only — the COA is the source of truth. See §3.3.                             |
| `tests`                | `TestRequestInputDto[]`     | Required, min 1 item           | Which tests from the lab's active test catalog to request. Drives the `estimated_lab_cost_usd` calculation. See §3.4.                                                       |

### 3.3 Sample Claim (`SampleClaimInputDto`)

Claims are informational context for contributors. They are **not** used for campaign resolution — only the COA matters. Each claim has a `claim_type` that determines which additional fields are required:

| `claim_type` | Required additional fields                                                                                                        | Description                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mass`       | `mass_amount` (number ≥ 0) + `mass_unit` (string, must be in `valid_mass_units` config)                                           | States the quantity of active ingredient. E.g. _"5 mg BPC-157 per vial"_.                                              |
| `purity`     | `purity_percent` (number 0–100)                                                                                                   | States the purity of the compound. E.g. _"98% purity"_.                                                                |
| `identity`   | _(implicit — uses the sample's `peptide_id`)_                                                                                     | Asserts that the product is the peptide referenced by `peptide_id`. The peptide name is shown read-only in the wizard. |
| `endotoxins` | Either `endotoxin_value` (number ≥ 0, EU/mL) OR `endotoxin_pass` (boolean) — which one depends on the lab test's `endotoxin_mode` | States actual endotoxin level or pass/fail result.                                                                     |
| `sterility`  | `sterility_pass` (boolean)                                                                                                        | States whether the sample is sterile.                                                                                  |
| `other`      | `other_description` (string, non-empty)                                                                                           | Catch-all for any additional claim not covered by the above types.                                                     |

> **Claim auto-derivation in the wizard:** When a creator selects tests in the wizard, `claim_templates` attached to those tests automatically suggest the appropriate claims. Required templates cannot be removed; optional ones can be. The creator can also add custom `other` claims.

### 3.4 Test Request (`TestRequestInputDto`)

| Field     | Type   | Constraints | Description                                                                                                                                                                                                                                                             |
| --------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_id` | `UUID` | Required    | A `Test` that the chosen `target_lab` actively offers (i.e. a `LabTest` row exists with `is_active=true` for this `lab_id` + `test_id` combination). The backend validates this at creation time and throws `ValidationError` if the test is not available at that lab. |

### 3.5 System-Computed Fields (Set by Backend at Creation)

These are never supplied by the creator:

| Field                          | How it is computed                                                                                        | Description                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `verification_code`            | Random 6-digit integer, unique across all campaigns (retry loop up to 10 tries)                           | Printed on the COA by the lab so admins can match the document to the campaign. Creator displays it on their product listing to prove ownership. |
| `funding_threshold_usd`        | `max(amount_requested × threshold_percent / 100, global_minimums.min_funding_threshold_usd)`              | The minimum USD amount that must be raised before the creator can lock the campaign. Always at least the platform global minimum.                |
| `estimated_lab_cost_usd`       | Sum of `LabTest.price_usd` for every requested test across all samples                                    | Used to validate the creator's ask (must be ≤ 1.5× this value). Displayed to contributors.                                                       |
| `platform_fee_percent`         | Snapshot of `platform_fee_percent` config value at creation time                                          | Frozen at creation so later config changes don't affect in-flight campaigns.                                                                     |
| `effective_lock_threshold_usd` | `min(funding_threshold_usd, global_minimums.min_funding_threshold_usd)`                                   | The threshold that actually gates locking. Computed at runtime, not stored.                                                                      |
| `deadline_fundraising`         | `created_at + 14 days`                                                                                    | Fundraising window.                                                                                                                              |
| `is_flagged_for_review`        | `true` if creator has 0 previously resolved campaigns OR `amount_requested_usd > auto_flag_threshold_usd` | Auto-flag for admin review queue. Blocks the creator from locking until cleared.                                                                 |
| `status`                       | Always `'created'`                                                                                        | Initial status.                                                                                                                                  |
| `creator_id`                   | The authenticated user's ID                                                                               | FK to `User`.                                                                                                                                    |

### 3.6 Fields Set on State Transitions

| Field                      | Set when                    | Value                                                                                              |
| -------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| `funded_at`                | Campaign locks              | `now()` (if not already set)                                                                       |
| `locked_at`                | Campaign locks              | `now()`                                                                                            |
| `deadline_ship_samples`    | Campaign locks              | `funded_at + 7 days`                                                                               |
| `samples_sent_at`          | Creator ships samples       | `now()`                                                                                            |
| `deadline_publish_results` | Creator ships samples       | `now() + 21 days`                                                                                  |
| `results_published_at`     | Last COA manually approved  | `now()`                                                                                            |
| `resolved_at`              | Campaign resolved           | `now()`                                                                                            |
| `refunded_at`              | Campaign refunded           | `now()`                                                                                            |
| `refund_reason`            | Campaign refunded           | Admin-supplied reason string                                                                       |
| `current_funding_usd`      | Every contribution / refund | Running total maintained by `ContributionService`                                                  |
| `is_flagged_for_review`    | Admin flags/unflags         | Admin-controlled boolean                                                                           |
| `flagged_reason`           | Admin flags                 | Admin-supplied reason string                                                                       |
| `is_hidden`                | Admin hides/unhides         | Admin-controlled boolean; hidden campaigns are excluded from the public feed but visible to admins |

---

## 4. Supporting Data Managed Outside the Campaign

These entities are referenced by campaign samples but managed independently:

| Entity             | Relevance to Campaign                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Peptide**        | Optional reference on a sample. Enables `identity` claims and clean display. Users can submit new peptides for admin approval during the creation wizard.                        |
| **Vendor**         | Optional reference on a sample. Users can submit new vendors for admin review during the wizard; the campaign proceeds immediately regardless of approval status.                |
| **Lab**            | Required reference on each sample (`target_lab_id`). Only `is_approved=true` labs can be selected. Labs are managed exclusively by admins.                                       |
| **LabTest**        | Drives test selection and price estimation. Each lab has a price list of tests; a sample's `tests` array references IDs from this list.                                          |
| **COA**            | One per sample, uploaded by the creator after samples are shipped. Reviewed and approved/rejected by admins. Drives campaign advancement to `results_published`.                 |
| **Contribution**   | One per contributor per act of funding. Stored with the original currency (USDC or USDT) for audit; refunded to the unified `LedgerAccount.balance` if the campaign is refunded. |
| **CampaignEscrow** | One per campaign. Internal ledger balance holding all contributed funds until resolution or refund. No on-chain wallet — purely a DB balance.                                    |

---

## 5. Frontend Surfaces

| Page / Component                                                     | Route                | What It Does                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`HomePage`](packages/fe/src/pages/HomePage.tsx)                     | `/`                  | Public campaign feed. Infinite scroll. Cards show status, funding progress, vendor/lab, time remaining. Hidden campaigns excluded (unless admin).                                                                |
| [`CreateCampaignPage`](packages/fe/src/pages/CreateCampaignPage.tsx) | `/create`            | 3-step wizard: (1) Basics — title, description, amount, threshold; (2) Samples — per-sample peptide, vendor, lab, tests, claims; (3) Review — summary + verification code display. Auto-saves to `localStorage`. |
| [`CampaignDetailPage`](packages/fe/src/pages/CampaignDetailPage.tsx) | `/campaigns/:id`     | Public detail view. Tabs: Overview, Samples, Results (COAs), Updates, Funding. Creator-only action bar: Lock, Ship, Add Update, Upload COA. Contributor sticky CTA: Contribute.                                  |
| [`MyCampaignsPage`](packages/fe/src/pages/MyCampaignsPage.tsx)       | `/my-campaigns`      | Creator's campaign list, filterable by status. Inline edit (title/description) and delete (only `created` with zero contributions).                                                                              |
| **Admin Campaigns Tab**                                              | `/admin` → Campaigns | Paginated list filterable by status and "Flagged Only". Flag/unflag, hide/unhide, force-refund with reason modal.                                                                                                |

---

## 6. Key Business Rules Summary

| Rule                                                            | Where Enforced                                            |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| Creator must have ≥ `min_creator_balance_usd` to create         | `CampaignService.createCampaign`                          |
| Target labs must be approved                                    | `CampaignService.createCampaign`                          |
| Requested amount ≤ 1.5× estimated lab cost                      | `CampaignService.createCampaign` + `CreateCampaignPage`   |
| `funding_threshold_percent` must be 5–100                       | DB constraint + service validation                        |
| Each sample needs ≥ 1 test and ≥ 1 claim                        | `CampaignService.createCampaign`                          |
| Tests must be offered by the chosen lab                         | `CampaignService.createCampaign`                          |
| Only creator can lock/ship/update/upload                        | `AuthorizationError` guard in service                     |
| Flagged campaigns cannot be locked                              | `CampaignService.lockCampaign`                            |
| Editing only allowed in `created` status                        | `CampaignService.updateCampaign`                          |
| Delete only allowed in `created` with zero funding              | `CampaignService.deleteCampaign`                          |
| Only `manually_approved` COA status advances campaign           | `CoaService.verifyCoa` (OCR signals are informational)    |
| 3 COA rejections → auto-refund                                  | `CoaService.verifyCoa` (increments `coa.rejection_count`) |
| Fee rounding uses `ROUND_DOWN`                                  | `CampaignService.resolveCampaign`                         |
| Resolution and refund transactions use `SERIALIZABLE` isolation | `CampaignService.resolveCampaign` + `refundContributions` |
| Contributors receive email-verified gate before contributing    | `ContributionService`                                     |
