# Screen: Campaign Detail

**Route:** `/campaigns/:id`  
**Auth:** Public (some sections and actions require auth)

---

## Purpose

The full view of a single campaign. Serves three audiences simultaneously: a potential contributor evaluating whether to back it, the creator managing it through its lifecycle, and anyone following the progress and test results.

---

## What the Screen Shows

### Header Information (always visible)

- Campaign title.
- Current status (with flagged-for-review indicator if applicable).
- Creator's username and a count of their previously resolved campaigns (signals credibility).
- If the campaign is flagged for review: a visible warning that the campaign is under admin review. Contributors cannot fund a flagged campaign.

### Funding Progress

- Current amount raised.
- Funding goal (the threshold amount, not the total requested).
- Total amount requested.
- Percentage funded.
- Time remaining on the fundraising deadline (only relevant during `created` status).
- Platform fee percentage (disclosed so contributors understand what the creator receives).

### Reaction Bar

Any authenticated user (except the creator) can leave an emoji reaction. Five reaction types are available: thumbs up, rocket, praising hands, mad, fire. Each shows a count. A user can toggle their reaction on and off. Unauthenticated users can see counts but cannot react.

### Content Tabs

The detail page is organised into tabs so content doesn't compete for space:

#### Overview

- The campaign description in full.
- If the creator enabled an itemised cost breakdown, it is shown here.

#### Samples

A card per sample. Each card shows:

- Sample label.
- Vendor name.
- Peptide name (if selected from catalog).
- Physical description.
- Target lab name.
- Tests requested (names, not prices).
- Claims the creator made about the sample (informational context only).
- **COA status for this sample** — this is the most important part of this tab for an active campaign. See COA States below.

#### Results

A list of all uploaded COA documents for the campaign. Each entry shows:

- File name.
- Upload date.
- Verification status badge.
- A link to view the PDF (opens in a new tab via pre-signed URL).

This tab is empty until samples are shipped and COAs begin to be uploaded.

#### Updates

A reverse-chronological list of creator text updates and system state-change records. Each entry shows:

- Content.
- Author.
- Relative timestamp.

#### Backers

A list of contributions to this campaign. Each entry shows:

- Contributor username (linked to their public profile).
- Amount contributed.
- Contribution date.
- Status (completed or refunded).

---

## COA States Per Sample (in the Samples tab)

Each sample card shows the current COA state clearly:

| State               | What the user sees                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No COA uploaded yet | "Awaiting upload" — no action for contributors                                                                                                                                                                                                                                        |
| `pending`           | "Pending review" — COA uploaded, admin has not acted yet                                                                                                                                                                                                                              |
| `code_found`        | "OCR: code found" — informational, still awaiting admin approval                                                                                                                                                                                                                      |
| `code_not_found`    | "OCR: code not found" — informational, still awaiting admin manual review                                                                                                                                                                                                             |
| `manually_approved` | "Approved" — this sample is cleared                                                                                                                                                                                                                                                   |
| `rejected`          | **"Rejected"** — prominent. Shows the rejection reason (`verification_notes`). Shows the current rejection count (e.g. "Rejection 2 of 3"). If creator, shows a "Replace COA" button. If at 2/3 rejections, a warning is shown that the next rejection will auto-refund the campaign. |

---

## Creator-Only Actions

When the authenticated user is the campaign creator, an action section is shown (not visible to contributors). Available actions depend on status:

| Status              | Available Creator Actions |
| ------------------- | ------------------------- |
| `created`           | Lock Campaign             |
| `funded`            | Ship Samples, Upload COA  |
| `samples_sent`      | Upload COA, Post Update   |
| `results_published` | Post Update               |
| `resolved`          | Post Update               |

### Lock Campaign

Opens a confirmation flow. The flow shows:

- Whether the funding threshold has been met (current amount vs. required, pass/fail).
- Whether the campaign is under review (if flagged, this requirement fails and locking is blocked until the admin clears the flag).
- A warning that locking is permanent and closes contributions.

The confirm action is only enabled if all requirements pass.

### Ship Samples

Opens a confirmation flow. The flow:

- Reminds the creator to have physically sent all samples before confirming.
- Shows the lab name and address for each sample for reference.
- Warns that confirming starts the 21-day results window.

### Upload COA

Opens a flow where the creator:

1. Selects which sample this COA is for (a list of samples that do not yet have an approved COA, or that have a rejected COA).
2. Selects a PDF file.
3. Confirms the upload.

### Replace COA (after rejection)

Available directly on the rejected sample card. Opens the same upload flow as above but pre-selects the rejected sample. The rejection reason is shown inline before the file picker so the creator understands what needs to be fixed.

### Post Update

Opens a text input for free-form creator updates. Submitted updates appear in the Updates tab.

---

## Contributor Action

### Contribute (non-creator, campaign in `created` or `funded` status, not flagged)

A contribute action is accessible to authenticated, email-verified contributors. It opens a flow where the user:

- Sees their current wallet balance.
- Enters an amount.
- Confirms the contribution.

If the user is not authenticated, tapping contribute redirects to login.  
If the user is authenticated but not email-verified, they are prompted to verify their email first.  
If the campaign is flagged for review, contributing is blocked with an explanation.

---

## Notifications That Drive This Screen

The creator's view of this screen changes as these notifications fire:

| Notification                       | What changes on this screen                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Campaign crosses funding threshold | Funding progress shows ≥ 100%                                                 |
| COA rejected                       | Rejected sample card gains rejection reason + "Replace COA" button            |
| COA approved                       | Sample card shows "Approved" status                                           |
| All COAs approved                  | Status changes to `results_published`                                         |
| Campaign resolved                  | Status changes to `resolved`; payout confirmation shown to creator            |
| Campaign refunded                  | Status changes to `refunded`; refund reason shown prominently to all visitors |

---

## States for Refunded Campaigns

Refunded campaigns remain publicly accessible. A prominent notice explains the refund reason. The status badge shows "Refunded". Contributors who were refunded see their money returned in their wallet.

---

## Public vs. Hidden

If `is_hidden = true` and the viewer is not an admin, the campaign detail page returns a "not found" state.
