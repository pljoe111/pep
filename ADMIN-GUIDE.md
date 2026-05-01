# PepLab — Full Administrator Guide

This guide is for users with the `admin` claim. Admins have unrestricted access to every panel, including financial operations, platform configuration, and role management. Handle everything here with care — most actions are irreversible or have immediate on-chain effects.

---

## Access

Log in with your admin account. The **Admin** tab appears in the navigation automatically once your `admin` claim is active. Only users with the `admin` claim can see it.

> If you need admin access granted or revoked, another admin must manage your claims under **Users → Claims**.

---

## The Admin Panel — Tab Overview

| Tab           | Purpose                                                                |
| ------------- | ---------------------------------------------------------------------- |
| **Campaigns** | View, filter, flag, hide, and force-refund campaigns                   |
| **COAs**      | Review Certificate of Analysis submissions, run OCR, approve or reject |
| **Users**     | Search users, view stats, ban/unban, manage claims                     |
| **Vendors**   | Approve or reject vendor submissions                                   |
| **Peptides**  | Approve or reject peptide submissions                                  |
| **Labs**      | Add, edit, approve, and deactivate testing labs                        |
| **Tests**     | Manage the test catalog and claim templates                            |
| **Config**    | Edit live platform configuration values                                |
| **Actions**   | Treasury snapshot, fee sweep, USDC→USDT consolidation                  |

---

## Campaigns

### Viewing Campaigns

The Campaigns tab shows a paginated list of all campaigns across every status. Use the filter bar to narrow by:

- **Status** — `created`, `funded`, `samples_sent`, `results_published`, `resolved`, `refunded`
- **Flagged only** — shows campaigns currently under review

Each row shows the campaign title, creator, funding progress, status, and flag state.

### Flagging a Campaign

Flagging pauses contributions to a campaign and marks it for review. Use this when you spot suspicious activity, an inflated goal, or a CoA that doesn't match the campaign.

1. Open the campaign row
2. Click **Flag**
3. Optionally enter a reason — this is stored in the audit log and visible to other admins
4. Confirm

To clear a flag: open the same campaign and click **Unflag**.

> Campaigns requesting over the `auto_flag_threshold_usd` config value are flagged automatically on creation. Review these before clearing the flag.

### Hiding a Campaign

Hidden campaigns are removed from the public feed but still accessible by their creator and by admins. Use this sparingly — for spam, duplicate campaigns, or content violations.

1. Open the campaign row
2. Click **Hide** / **Unhide**

Hidden campaigns can still be funded if someone has the direct link, so for serious violations use Flag + Force Refund.

### Force Refund

Returns all contributions to contributors immediately, regardless of current campaign status. This is destructive and cannot be undone.

1. Open the campaign row
2. Click **Force Refund**
3. Enter a reason (required — recorded in the audit log)
4. Confirm

The campaign moves to `refunded` status. All contributor ledger balances are restored.

---

## CoAs (Certificates of Analysis)

When a campaign creator uploads a CoA PDF, it enters the verification queue in `pending` status. Your job is to confirm the document is genuine and matches the campaign.

### The CoA Queue

The COAs tab lists all submissions. Filter by:

- **Pending** — awaiting your review
- **Approved** — already verified
- **Rejected** — sent back to the creator

Each row shows the campaign name, the lab, the sample label, the tests requested, and the rejection count (how many times this CoA was rejected before).

### Running OCR

If the PDF preview doesn't show the content clearly, click **Run OCR** on the CoA row. This extracts the text from the PDF and displays it in the review panel. Use the extracted text to verify the campaign verification code appears in the document.

### Approving a CoA

Once you've confirmed:

1. The verification code embedded in the document matches the campaign's code
2. The lab name on the document matches the lab selected in the campaign
3. The tests requested are reflected in the results

Click **Approve**. The campaign moves to `results_published` and the escrow payout is queued.

### Rejecting a CoA

If the document is missing the verification code, from the wrong lab, illegible, or doesn't contain the requested tests:

1. Click **Reject**
2. Enter notes explaining what's wrong — the creator sees these notes and uses them to re-upload a corrected document

Track the **rejection count**. A high count may indicate a bad-faith creator.

---

## Users

### Searching Users

The Users tab has a search field. Enter a full or partial email or username. Results are paginated.

Each user row shows email, username, join date, email verification status, ban status, and active claims.

### User Detail

Click any user row to open their detail panel. This shows:

- Account info and verification status
- Active claims (`admin`, `lab_approver`, `campaign_creator`, `contributor`)
- Contribution stats: total amount contributed, campaigns created, successful completions, and refunds
- Their full campaign history

### Banning a User

Banning immediately revokes all active sessions (the user is logged out), prevents new logins, and blocks all platform actions.

1. Open the user row
2. Click **Ban**
3. Optionally add a reason
4. Confirm

To unban: same flow, click **Unban**.

> You cannot ban yourself. The system will reject the attempt.

### Managing Claims

Claims control what a user can do on the platform:

| Claim              | What it enables                                      |
| ------------------ | ---------------------------------------------------- |
| `contributor`      | Can fund campaigns and make withdrawals              |
| `campaign_creator` | Can create campaigns                                 |
| `lab_approver`     | Can approve and reject CoAs (moderator-level access) |
| `admin`            | Full admin panel access                              |

To grant or revoke a claim:

1. Open the user's detail panel
2. Under **Claims**, click **Grant** or **Revoke** next to the appropriate claim
3. Confirm

> Be careful granting `admin`. An admin can manage other admins, including revoking your own access.

---

## Vendors

User-submitted vendors go through a review queue before they're available in campaign creation.

### Approving a Vendor

When a user submits a new vendor, it appears in the Vendors tab as `pending`. Review the name and any submitted details, then click **Approve**.

### Rejecting a Vendor

If the vendor is a duplicate, invalid, or violates platform rules:

1. Click **Reject**
2. Enter a reason
3. Confirm

Rejected vendors are not deleted — they stay in the system with `rejected` status and a visible rejection reason.

---

## Peptides

Same flow as Vendors. User-submitted peptides require admin review before they appear as selectable options in campaign creation.

- **Approve** — makes the peptide available to all users
- **Reject** — requires a reason; the peptide stays visible to admins

---

## Labs

Labs are the testing facilities campaigns are directed to. Only approved labs appear in campaign creation.

### Adding a Lab

1. Click **Add Lab** in the Labs tab
2. Enter the lab name and country
3. Save — the lab is created in `pending` state

### Approving a Lab

Click **Approve** on any pending lab. Approved labs become selectable in campaign creation.

### Editing a Lab

Click the edit icon on any lab row. You can update the name and country.

### Deactivating a Lab

Deactivated labs no longer appear in campaign creation but existing campaigns assigned to them are unaffected. Use this instead of deleting.

---

## Tests

The test catalog defines what types of analysis a lab can perform. Campaign creators select from this catalog when setting up test requests.

### Creating a Test

1. Click **Add Test** in the Tests tab
2. Enter a name, description, and optional USP code
3. Save

### Disabling a Test

Disabled tests no longer appear in the campaign creation flow. Existing test requests are unaffected.

### Claim Templates

Each test can have claim templates — these define the expected output fields (e.g., purity percent, mass amount) that CoA data is extracted into during OCR. Manage these in the **Claim Templates** sub-section of the Tests tab.

---

## Platform Configuration

The Config tab exposes all live platform settings. Changes take effect immediately (cached for 60 seconds).

| Config Key                   | What It Does                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `platform_fee_percent`       | Percentage taken from successful campaign payouts. Default: `5`                    |
| `global_minimums`            | Minimum contribution, funding threshold, withdrawal, and creator balance (all USD) |
| `auto_flag_threshold_usd`    | Campaigns requesting above this USD amount are auto-flagged. Default: `10000`      |
| `max_campaign_multiplier`    | Max ratio of requested amount to estimated lab cost. Default: `10`                 |
| `max_withdrawal_per_day`     | Rolling 24-hour withdrawal request limit per user. Default: `10`                   |
| `max_file_size_bytes`        | Maximum CoA upload size. Default: `10485760` (10 MB)                               |
| `valid_mass_units`           | Allowed units for sample mass claims, e.g. `mg`, `g`, `mcg`                        |
| `default_sweep_wallet`       | Default Solana address pre-filled in the fee sweep form                            |
| `deposit_conversion_fee_bps` | Basis points charged on USDC and PYUSD deposits. `50` = 0.5%                       |

To edit a value:

1. Click the row in the Config tab
2. Edit the JSON value
3. Save

Values are JSON — objects, arrays, numbers, and strings are all valid depending on the key. The existing value shape is shown inline; don't change the structure, only the values inside it.

---

## Treasury & Financial Operations

The **Actions** tab is for financial operations that move real on-chain funds. Double-check every address before confirming.

### Treasury Snapshot

The top of the Actions tab shows a live read-only snapshot:

- **Master wallet** — on-chain USDT, USDC, and PYUSD balances
- **Fee account** — accumulated platform fees held on-platform (not yet on-chain)
- **Ledger** — total user balances and escrow balances across all accounts

Use this to verify the platform is solvent: total user balances + total escrow balances should not exceed the master wallet total.

### Fee Sweep

Transfers all accumulated platform fees from the fee account to a Solana wallet as USDT.

1. Review the fee account balance in the treasury snapshot
2. Enter the destination Solana address (or use the `default_sweep_wallet` config pre-fill)
3. Click **Sweep Fees**
4. Confirm

This queues a withdrawal transaction. Monitor the withdrawal worker logs if the transfer doesn't appear on-chain within a few minutes.

### USDC → USDT Consolidation

When the master wallet holds USDC or PYUSD (from user deposits), it can be swapped to USDT via Jupiter on-chain. This only executes if the USDC balance meets the `CONSOLIDATION_THRESHOLD_USDC` environment variable threshold.

1. Click **Trigger Consolidation**
2. Confirm

Both USDC→USDT and PYUSD→USDT swaps are attempted independently. The response tells you whether each was triggered and why (e.g., "below threshold").

> This sends live on-chain transactions. Do not spam it — wait for the on-chain confirmation before triggering again.

---

## Audit Log

Every admin action is recorded automatically in the audit log, including who performed it, what was changed, and when. The current UI doesn't expose a browsable audit log view, but all entries are in the `audit_log` database table and can be queried directly if needed.

Actions logged include: campaign flag/unflag/hide/unhide/force-refund, user ban/unban, claim grant/revoke, config update, CoA approve/reject, and fee sweep.

---

## Key Rules & Reminders

- **Force refund is irreversible.** Once contributions are returned, the campaign cannot be re-activated.
- **Fee sweep moves real on-chain USDT.** Verify the destination address carefully.
- **Banning a user immediately invalidates their sessions.** They are logged out on all devices.
- **Config changes are live immediately.** There is no staging — a wrong value affects all users within 60 seconds.
- **Granting `admin` is permanent until explicitly revoked.** Keep the admin list small.
