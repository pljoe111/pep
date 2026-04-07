# PepLab — User Stories

> **Perspective:** Optimal UX from the user's point of view. Not a description of what is currently built — a description of what should feel right.
>
> Two primary roles: **Creator** (person who wants something tested) and **Contributor** (person who funds campaigns). A single account can be both.

---

## Table of Contents

1. [Onboarding & Identity](#1-onboarding--identity)
2. [Browsing & Discovery (Contributor)](#2-browsing--discovery-contributor)
3. [Contributing to a Campaign (Contributor)](#3-contributing-to-a-campaign-contributor)
4. [Following a Campaign (Contributor)](#4-following-a-campaign-contributor)
5. [Creating a Campaign (Creator)](#5-creating-a-campaign-creator)
6. [Managing a Live Campaign (Creator)](#6-managing-a-live-campaign-creator)
7. [Shipping Samples (Creator)](#7-shipping-samples-creator)
8. [Uploading & Replacing a COA (Creator)](#8-uploading--replacing-a-coa-creator)
9. [COA Rejection — Notifications & Recovery (Creator)](#9-coa-rejection--notifications--recovery-creator)
10. [Campaign Resolution & Payout (Creator)](#10-campaign-resolution--payout-creator)
11. [Campaign Refund (Both Roles)](#11-campaign-refund-both-roles)
12. [Wallet & Funding (Both Roles)](#12-wallet--funding-both-roles)
13. [Notifications (Both Roles)](#13-notifications-both-roles)

---

## 1. Onboarding & Identity

### US-01 — Register with email

> As a new user, I want to register with just an email and password so I can start immediately without OAuth friction.

**Acceptance criteria:**

- Single screen: email + password + confirm password.
- After submitting, I land on the home feed immediately (not blocked by email verification).
- A dismissable yellow banner at the top says _"Please verify your email to contribute to campaigns"_ — not intrusive but persistent until dismissed or verified.
- I receive a verification email within 30 seconds.

---

### US-02 — Verify email when I need to contribute

> As a registered user with an unverified email, I want to be prompted to verify exactly when I try to contribute — not before.

**Acceptance criteria:**

- I can browse, create campaigns, and view results without verifying.
- Tapping "Contribute" on any campaign shows a friendly in-line prompt: _"Verify your email to contribute"_ with a "Resend email" button.
- After verification I return directly to the campaign I was trying to fund.

---

## 2. Browsing & Discovery (Contributor)

### US-10 — Browse the campaign feed

> As a contributor, I want to scroll through active campaigns and quickly assess which ones are worth funding.

**Acceptance criteria:**

- Each card shows: campaign title, creator name, vendor & lab name, sample labels (up to 2), funding progress bar + percentage, amount raised vs. goal, time remaining.
- Status badge is always visible: Open / Funded / In Lab / Results Out / Resolved.
- Cards for campaigns under admin review show a small amber "Under Review" badge — I can still view them but I cannot contribute.
- Hidden campaigns are invisible to me.

---

### US-11 — Filter and search campaigns

> As a contributor, I want to narrow the feed by what I care about so I don't scroll through noise.

**Acceptance criteria:**

- A filter strip at the top of the feed: **All | Open | Funded | In Lab | Results Out | Resolved**.
- A search bar: fuzzy matches campaign title, peptide name, vendor name, or lab name.
- Sort options: Newest, Ending Soon, Most Funded, Least Funded.
- Filters persist across sessions (stored in URL or localStorage).

---

### US-12 — See everything I need on the campaign detail page

> As a contributor evaluating a campaign, I want a detail page that answers every question I might have before putting in money.

**Acceptance criteria:**

- **Hero section:** Title, status badge, creator info (username, # of successfully resolved campaigns), flagged-for-review warning if applicable.
- **Funding card:** Progress bar, % funded, amount raised, goal (funding threshold), total requested, time remaining, platform fee disclosure.
- **Reaction bar:** Emoji reactions (👍 🚀 🙌 😤 🔥) with counts — one tap to react, same tap to remove.
- **Tabs:**
  - **Overview** — Description (full text), optional itemized cost breakdown.
  - **Samples** — Each sample: label, vendor, peptide, physical description, which tests were requested, what claims the creator makes.
  - **Results** — COA documents once uploaded. Each shows file name, upload date, a "View PDF" link. COA status badge (Pending Review / Approved / Rejected).
  - **Updates** — Creator text updates, state-change history, in reverse-chronological order.
  - **Backers** — Contributor list with amount and timestamp.
- **Sticky CTA:** "Contribute" button fixed above the bottom nav — always visible to non-creators.

---

## 3. Contributing to a Campaign (Contributor)

### US-20 — Contribute to an open campaign

> As a contributor, I want to fund a campaign in as few taps as possible.

**Acceptance criteria:**

- Tapping the "Contribute" button opens a bottom sheet (not a full-page redirect).
- Sheet shows my current wallet balance prominently.
- Single number input (USD amount) with a `$` prefix.
- Quick-select chips for common amounts: $10 / $25 / $50 / $100.
- "Contribute" button confirms. I see a success toast and the sheet closes.
- The campaign's progress bar updates immediately (optimistic UI).
- I cannot contribute to a campaign I created.
- I cannot contribute to a flagged-for-review campaign.

---

### US-21 — Know that I already contributed

> As a returning contributor, I want to see my past contribution on the campaign so I don't accidentally double-fund.

**Acceptance criteria:**

- On the campaign detail page, if I have contributed, a small teal pill shows _"You contributed $X"_ near the funding card.
- My entry is highlighted (subtle teal border) in the Backers tab.

---

## 4. Following a Campaign (Contributor)

### US-30 — Track campaigns I've backed

> As a contributor, I want a personal list of every campaign I've put money into, and its current status.

**Acceptance criteria:**

- "My Contributions" section within the Wallet page (or a dedicated tab).
- Each row: campaign title (linked), status badge, my contribution amount, campaign funding progress, contribution date.
- Status progresses visually as the campaign moves through states.

---

## 5. Creating a Campaign (Creator)

### US-40 — Create a campaign in 3 focused steps

> As a creator, I want to create a campaign in a linear wizard that breaks the process into manageable chunks so I'm never overwhelmed.

---

#### Step 1 — The Goal

_What are you raising money for and how much do you need?_

| Field                      | UX detail                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Campaign Title**         | Text input. Placeholder: _"e.g. Test My BPC-157 Capsules"_. Character counter (200 max).                                                                                              |
| **Description**            | Multi-line textarea. Prompt: _"Describe the product, why you want it tested, and what you hope to find out."_                                                                         |
| **Amount Requested (USD)** | Number input with `$` prefix. Real-time hint: _"Estimated lab cost: $X"_ updates as test selections are made in Step 2.                                                               |
| **Lock Threshold**         | Slider from 5% to 100% (default 70%). Label reads: _"Lock campaign when X% funded."_ Tooltip explains: _"You can only ship samples once you lock. Locking closes new contributions."_ |

**Smart guidance:**

- If the amount is more than 1.5× the estimated lab cost, an inline warning appears before the user can advance: _"Your ask is \_\_ × your lab costs. Reduce it or explain the gap in your description."_
- Platform fee is shown as a soft line: _"Platform keeps X% on resolution."_

---

#### Step 2 — Your Samples

_What are you sending to the lab?_

One card per sample. Default is one card open. "+ Add Sample" appears once the first sample is valid.

**Per-sample card:**

**Section A — What did you buy?**

| Field                    | UX detail                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Peptide**              | Searchable combobox. Fuzzy match against the approved peptide catalog. If mine isn't listed, a _"Submit a new peptide +"_ option appears — fills a small inline form and the wizard continues immediately (approval is async). |
| **Vendor**               | Searchable combobox. If mine isn't listed, _"Submit a new vendor +"_ — same async pattern.                                                                                                                                     |
| **Purchase Date**        | Date picker. Cannot be in the future or more than 10 years ago.                                                                                                                                                                |
| **Physical Description** | Optional short text. Placeholder: _"White powder, gray capsules, unflavoured"_.                                                                                                                                                |
| **Sample Label**         | Auto-filled from `{Peptide} from {Vendor}` but editable. This is the label shown on COA matching.                                                                                                                              |

**Section B — Where is it going?**

| Field          | UX detail                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Target Lab** | Dropdown of approved labs with country shown. Selecting a lab loads its test menu below.                                                             |
| **Tests**      | Checkbox list from lab's active test menu. Each row: test name, vials required, price. Running total of vials and cost updates as boxes are checked. |

**Section C — What are you claiming?** _(Auto-derived, for contributor context only)_

- Claims are auto-suggested from the selected tests' claim templates.
- Required claims cannot be removed; optional ones have a Remove button.
- Each claim type has the right input (number, %, pass/fail toggle).
- A blue info banner: _"Claims are for contributor context only. The COA is the source of truth."_
- Creator can add custom claims with "+ Add Custom Claim."

**Multi-lab split banner:**

- If samples are going to different labs, a banner appears: _"Your samples are going to different labs. Keep them in one campaign or create separate campaigns for cleaner tracking."_

---

#### Step 3 — Review & Confirm

_Check everything before it goes live._

- Summary card: title, description excerpt, amount, lock threshold, sample list.
- **Estimated lab cost** prominently displayed.
- **Verification Code** displayed in a large amber box with copy button:
  > _"Your Verification Code: **482910**"_
  > _"Add this code to your product listing (website, Telegram post, etc.) to prove this campaign is yours."_
- "Create Campaign" button → confirmation dialog → campaign goes live.
- Form is auto-saved to localStorage throughout; returning to `/create` restores progress.

---

### US-41 — Save my progress and come back later

> As a creator mid-wizard, I want my work saved automatically so a phone call or app crash doesn't lose everything.

**Acceptance criteria:**

- Every field change writes to `localStorage` under a stable key.
- On returning to `/create`, a banner: _"You have an unfinished campaign. Continue?"_ with Continue and Start Fresh options.
- Start Fresh clears the saved state.

---

### US-42 — Understand the verification code

> As a creator, I want to clearly understand what the verification code is for and what I need to do with it.

**Acceptance criteria:**

- The code is shown in Step 3 of the wizard with explicit instructions.
- On the live campaign detail page, the code is shown inside a "Creator Actions" section (visible only to me) with the same instruction: _"Post this code on your product listing so backers can verify this is a legitimate campaign."_
- The code is also visible in the "My Campaigns" list row.

---

## 6. Managing a Live Campaign (Creator)

### US-50 — Edit my campaign while it's open

> As a creator, I want to fix typos or update my description after publishing, without having to delete and start over.

**Acceptance criteria:**

- In "My Campaigns," an Edit button is visible for campaigns in `created` status only.
- Edit opens a bottom sheet with `title` and `description` fields pre-filled.
- Saving patches the campaign immediately.
- Sample data (tests, lab, claims) **cannot** be edited after creation — a tooltip explains why: _"Samples are locked to protect contributors who backed this campaign based on what you described."_

---

### US-51 — Delete an unfunded campaign I haven't started yet

> As a creator, I want to permanently remove a campaign I accidentally published before anyone contributed.

**Acceptance criteria:**

- Delete is only available when status = `created` AND `current_funding_usd = 0`.
- In "My Campaigns," a Delete button with an inline confirmation: _"Delete '{title}'? This cannot be undone."_ Two-button row: Cancel + Delete (danger).
- On confirm, campaign disappears from my list and the feed.

---

### US-52 — Monitor funding progress in real time

> As a creator, I want to see how my campaign is performing without having to manually refresh.

**Acceptance criteria:**

- Campaign detail page auto-refreshes contribution data at a sensible interval (or via optimistic invalidation after each action).
- Progress bar animates to new value on update.
- I receive a push/email notification when my campaign crosses the lock threshold (fully funded).

---

### US-53 — Lock my campaign when I'm ready

> As a creator, I want to close my campaign to further contributions when I have enough to proceed, even if I haven't hit 100%.

**Acceptance criteria:**

- A "Lock Campaign" button is visible on my campaign detail page when status = `created`.
- Tapping it opens a bottom sheet with:
  - A checklist showing requirements:
    - ✅/❌ _"Funding threshold met"_ (shows current vs. required amount)
    - ✅/❌ _"Campaign not under review"_ (if flagged, explains what to do: _"Contact support to clear the review flag"_)
  - Current funding summary card.
  - Warning: _"Locking closes contributions. This cannot be undone."_
  - "Lock Campaign" button — disabled if requirements not met, with text _"Requirements not met"_.
- On success: status changes to `funded`, deadline for shipping samples is displayed: _"Ship your samples within 7 days."_

---

## 7. Shipping Samples (Creator)

### US-60 — Mark samples as shipped

> As a creator whose campaign is locked, I want to confirm that I've physically sent my samples to the lab so contributors know testing has begun.

**Acceptance criteria:**

- "Ship Samples" button visible on campaign detail when status = `funded`.
- Tapping opens a bottom sheet:
  - Confirmation prompt: _"Confirm that you have physically shipped all samples to the lab."_
  - Lab addresses for each sample shown for reference (derived from `sample.target_lab`).
  - Warning: _"Once confirmed, the 21-day results window begins."_
  - "Confirm Shipment" button.
- On success: status changes to `samples_sent`. All contributors are notified. A "deadline publish results" countdown appears on the detail page.

---

### US-61 — Know exactly what I need to do next after shipping

> As a creator who just confirmed shipment, I want clear next steps so I'm not left guessing.

**Acceptance criteria:**

- After shipping, the Creator Actions section shows: _"Upload a COA for each sample once the lab delivers results."_
- For each sample, an "Upload COA" card is shown in the Samples tab with status "Awaiting COA" in a muted gray — becomes actionable with an upload button.

---

## 8. Uploading & Replacing a COA (Creator)

### US-70 — Upload a COA for a sample

> As a creator, I want to upload the lab's Certificate of Analysis PDF for each sample so the community can see the results.

**Acceptance criteria:**

- Each sample in the Samples tab shows a COA upload card when no COA exists and status ∈ {`funded`, `samples_sent`, `results_published`}.
- Tapping "Upload COA" opens a bottom sheet:
  - The sample name is shown at the top so I know which one I'm uploading for.
  - File picker, PDF only. Shows file name + size after selection.
  - "Upload" button — disabled until a file is selected.
  - Progress indicator while uploading.
- Success: COA card replaces the upload prompt. Status shows "Pending Review" in gray.
- I receive an in-app notification: _"COA for {sample_label} received. An admin will review it shortly."_

---

### US-71 — See the current status of each COA at a glance

> As a creator, I want to know immediately which COAs are pending, approved, or have problems.

**Acceptance criteria:**

- Each sample card in the Samples tab has a COA status chip:
  - **Awaiting Upload** → gray, no file icon
  - **Pending Review** → gray with a clock icon
  - **OCR: Code Found** → teal, soft signal badge (not final)
  - **OCR: Code Not Found** → amber, informational (not blocking)
  - **Approved** ✅ → green, locked (no replace option)
  - **Rejected** ❌ → red, prominent "Replace COA" button visible
- The campaign header shows a summary pill: _"COAs: 2/3 approved"_

---

### US-72 — Replace a rejected COA without friction

> As a creator whose COA was rejected, I want to immediately understand why, upload a replacement, and not lose my progress.

**Acceptance criteria:**

The rejected sample card in the Samples tab shows:

```
┌─────────────────────────────────────────────┐
│ ❌  COA Rejected                             │
│                                             │
│  Reason: "Verification code not visible in  │
│  the header. Please upload the full lab      │
│  report PDF, not just the summary page."     │
│                                             │
│  Rejection 1 of 3                           │
│                                             │
│  [ Replace COA ]                            │
└─────────────────────────────────────────────┘
```

- The rejection reason (`verification_notes`) is always shown — never left blank by the admin.
- The rejection count (e.g., _"Rejection 1 of 3"_) is shown in amber.
- At 2/3: an escalated warning in orange: _"⚠ One more rejection will automatically refund all contributors."_
- Tapping "Replace COA" opens the same upload sheet as the initial upload (same UX, no extra steps).
- After replacement, the card reverts to "Pending Review" state.

---

## 9. COA Rejection — Notifications & Recovery (Creator)

### US-80 — Get notified immediately when my COA is rejected

> As a creator, I want to know the moment an admin rejects my COA so I can act quickly, especially given the 3-strikes rule.

**Acceptance criteria:**

- As soon as an admin rejects a COA, I receive:
  1. **In-app notification** (bell icon badge + notification center entry): _"COA Rejected — {sample_label}"_. Tapping navigates directly to that sample on the campaign detail page.
  2. **Email notification**: Subject: _"Action required: Your COA was rejected"_. Body includes the rejection reason, current rejection count, and a direct link to the campaign.
- Notification is sent regardless of whether I am currently in the app.

---

### US-81 — Understand the 3-strikes rule before it's too late

> As a creator, I want to be clearly warned about the auto-refund rule before I hit the limit, not after.

**Acceptance criteria:**

- On the first rejection: notification states _"Rejection 1/3 — You have 2 more attempts before an auto-refund is triggered."_
- On the second rejection: notification and on-page warning escalate to _"⚠ Rejection 2/3 — One more rejection will automatically refund all contributors. Please review carefully before re-uploading."_
- The campaign detail page shows a persistent orange banner while a COA is at 2/3 rejections:
  > _"⚠ Your campaign is one COA rejection away from an automatic refund. Please check the rejection reason carefully before re-uploading."_
- If the auto-refund triggers: notification says _"Your campaign was automatically refunded after 3 COA rejections. All contributors have been refunded."_

---

### US-82 — Get notified when my COA is approved

> As a creator, I want to know when each COA passes review so I can track my campaign's progress toward resolution.

**Acceptance criteria:**

- In-app notification: _"COA Approved — {sample_label}"_.
- If that was the last COA: additional notification: _"All COAs approved — your campaign is now in Results Published state. An admin will approve your payout shortly."_

---

## 10. Campaign Resolution & Payout (Creator)

### US-90 — See a clear payout summary before resolution

> As a creator about to be paid out, I want to understand exactly how much I'll receive before it happens.

**Acceptance criteria:**

- When status = `results_published`, the Creator Actions section on the campaign detail page shows a payout preview card:
  ```
  Escrow balance:      $480.00
  Platform fee (5%):  − $24.00
  ─────────────────────────────
  You receive:         $456.00
  ```
- A note: _"An admin is reviewing your resolution. You'll be notified when funds are credited."_

---

### US-91 — Get notified when funds land in my wallet

> As a creator, I want an immediate notification when my payout is credited so I know it's done.

**Acceptance criteria:**

- In-app notification: _"Campaign Resolved 🎉 — $456.00 has been credited to your wallet."_
- Email notification with the same content.
- Wallet page balance reflects the new amount immediately.
- "My Campaigns" shows the campaign in `resolved` status with a green checkmark.

---

## 11. Campaign Refund (Both Roles)

### US-100 — Get refunded immediately if a campaign is cancelled

> As a contributor, I want my money back in my PepLab wallet instantly if a campaign is refunded for any reason.

**Acceptance criteria:**

- In-app notification: _"Campaign Refunded — '{campaign_title}' has been refunded. $X has been returned to your wallet."_
- Email: same content plus the refund reason.
- Wallet balance updates immediately.
- The contribution appears in my wallet history as a Refund entry.

---

### US-101 — Understand why a campaign was refunded

> As a contributor, I want to see the refund reason on the campaign detail page so I can make better funding decisions in the future.

**Acceptance criteria:**

- Refunded campaigns remain visible and accessible (not deleted).
- A prominent red banner on the detail page: _"This campaign was refunded. Reason: {refund_reason}"_
- Status badge shows "Refunded" in red.

---

## 12. Wallet & Funding (Both Roles)

### US-110 — Deposit to fund my contributions

> As a contributor, I want to easily add USDT to my PepLab balance using a Solana wallet so I can back campaigns.

**Acceptance criteria:**

- Wallet page shows my current balance in large text.
- "Deposit" button opens a bottom sheet with:
  - My unique deposit address as a QR code and copyable text.
  - Instructions: _"Send USDT on Solana to this address. Funds arrive within 2-3 minutes."_
  - Warning: _"Only send USDT (SPL token) on the Solana network."_
- When a deposit is detected, I receive an in-app notification: _"Deposit confirmed — $X added to your balance."_

---

### US-111 — Withdraw my balance

> As a user with a balance, I want to withdraw to my Solana wallet.

**Acceptance criteria:**

- "Withdraw" button on Wallet page.
- Bottom sheet: destination address input (validated as a Solana public key), amount input, current balance shown.
- Confirmation step shows the deducted amount.
- After confirming: _"Withdrawal submitted. Funds will arrive within a few minutes."_
- In-app notification on success: _"Withdrawal sent — $X to {address}."_
- In-app notification on failure: _"Withdrawal failed — please contact support."_

---

## 13. Notifications (Both Roles)

### US-120 — Notification center

> As a user, I want a central place to see all my notifications so I don't miss anything important.

**Acceptance criteria:**

- Bell icon in the top bar with a badge showing unread count.
- Tapping opens a notification center (bottom sheet or dedicated page).
- Each entry: icon, title, body excerpt, relative timestamp, read/unread state.
- Tapping an entry navigates to the relevant campaign/wallet page and marks it read.
- "Mark all as read" button at the top.
- Unread notifications persist across sessions.

---

### US-121 — Full notification catalogue

Each of these events generates both an **in-app** notification and an **email**:

| Event                              | Who                    | Message                                                                     |
| ---------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| Campaign crosses funding threshold | Creator                | _"Your campaign '{title}' has reached its funding goal!"_                   |
| Campaign locked                    | All contributors       | _"'{title}' has been locked by the creator. Samples will be shipped soon."_ |
| Samples confirmed shipped          | All contributors       | _"Samples for '{title}' are on their way to the lab."_                      |
| COA rejected                       | Creator                | _"COA rejected for {sample_label} — Rejection {n}/3. Reason: {notes}"_      |
| COA approved                       | Creator                | _"COA approved for {sample_label}."_                                        |
| All COAs approved                  | Creator                | _"All COAs approved — campaign ready for resolution."_                      |
| Campaign resolved                  | Creator                | _"Campaign resolved 🎉 — $X credited to your wallet."_                      |
| Campaign resolved                  | All contributors       | _"'{title}' is resolved. Results are available."_                           |
| Campaign refunded                  | All contributors       | _"Campaign refunded — $X returned to your wallet. Reason: {reason}"_        |
| 2/3 COA rejections                 | Creator                | _"⚠ Warning: one more rejection will auto-refund '{title}'."_               |
| Auto-refund triggered              | Creator + Contributors | _"'{title}' was automatically refunded after 3 COA rejections."_            |
| Deposit confirmed                  | User                   | _"Deposit confirmed — $X added to your balance."_                           |
| Withdrawal sent                    | User                   | _"Withdrawal sent — $X to {address}."_                                      |
| Withdrawal failed                  | User                   | _"Withdrawal failed. Please contact support."_                              |

---

## Summary: Creator Journey at a Glance

```
Register → Deposit funds → Create Campaign (3 steps) → Campaign live
    → Contributors fund → Hit threshold → LOCK
    → Ship samples → Confirm shipment
    → Receive lab report → Upload COA (per sample)
    → Admin reviews COA:
        - Approved → next sample, or if last: Results Published → Admin approves resolution → PAYOUT 🎉
        - Rejected → fix reason → re-upload → repeat (max 3 times)
        - 3 rejections → AUTO-REFUND 💸
```

## Summary: Contributor Journey at a Glance

```
Browse feed → Read campaign detail → Deposit funds → Contribute
    → Follow progress (notifications)
    → Campaign resolves → View COA results in Results tab
    → (If refunded: funds return to wallet automatically)
```
