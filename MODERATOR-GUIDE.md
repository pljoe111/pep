# PepLab — Moderator Guide

This guide is for users with the `lab_approver` claim. Moderators handle the day-to-day content review queue: CoAs, campaigns, vendors, peptides, labs, and users. You do **not** need to know anything about wallets, Solana, or financial configuration — those operations are handled by full admins.

---

## Access

Log in with your moderator account. The **Admin** tab appears in the navigation automatically once your `lab_approver` claim is active.

> If you can't see the Admin tab, your claim hasn't been granted yet. Ask a full admin to grant you the `lab_approver` claim under Users → Claims.

---

## What You Can Do

| Area          | Your Actions                                               |
| ------------- | ---------------------------------------------------------- |
| **CoAs**      | Review submissions, run OCR, approve or reject             |
| **Campaigns** | View all campaigns, flag/unflag, hide/unhide, force refund |
| **Users**     | Search users, view details, ban/unban                      |
| **Vendors**   | Approve or reject vendor submissions                       |
| **Peptides**  | Approve or reject peptide submissions                      |
| **Labs**      | Approve labs, view existing labs                           |

## What You Cannot Do

- Edit platform configuration
- View or move treasury funds
- Trigger fee sweeps or USDC consolidation
- Grant or revoke user claims (including `admin`)
- Add or edit labs (view only for moderators)

---

## CoA Review — Your Main Job

This is the highest-priority queue. When a campaign creator uploads a Certificate of Analysis, it sits in `pending` until a moderator approves or rejects it. The campaign cannot pay out until the CoA is approved.

### Finding Pending CoAs

Go to the **COAs** tab. Filter by **Pending** to see what needs review. The list shows:

- Campaign name and verification code
- Lab name
- Sample label
- Tests requested (e.g., ID/P/P, Endotoxins)
- File upload date
- Rejection count — high numbers warrant extra scrutiny

### Opening a CoA

Click any CoA row to open the review panel. You'll see:

- A PDF viewer or download link for the document
- Campaign details: title, verification code, creator
- Lab and test info
- OCR extracted text (if already run)

### Running OCR

If the PDF is hard to read or you want to search the document text, click **Run OCR**. This extracts all text from the PDF and displays it in the panel. Use it to quickly find the verification code and lab name without downloading the file.

### What to Check Before Approving

Go through this list for every CoA:

1. **Verification code** — The campaign has a unique numeric code. That exact number must appear somewhere in the CoA document. If it's missing, reject.
2. **Lab name** — The lab on the document must match the lab selected in the campaign. A CoA from a different lab is a rejection.
3. **Tests present** — The document should show results for the tests that were requested. If the creator requested ID/P/P but the CoA only covers endotoxins, reject with notes explaining what's missing.
4. **Document looks legitimate** — If the PDF looks altered, low-quality, or doesn't resemble a real lab report format, flag it and note your concerns. When in doubt, reject and ask the admin to take a second look.

### Approving

When everything checks out:

1. Click **Approve**
2. Optionally add a note (visible internally)
3. Confirm

The campaign moves to `results_published`. The escrow payout is queued automatically — no further action needed from you.

### Rejecting

When something is wrong:

1. Click **Reject**
2. Write clear notes explaining exactly what's missing or wrong — the campaign creator reads these and uses them to fix and re-upload

Good rejection notes:

- "Verification code not found in document. Expected: 448271."
- "Lab name on document is 'ABC Testing' but campaign is assigned to BT Labs."
- "Endotoxin results are missing. Tests requested: ID/P/P and Endotoxins."

Avoid vague rejections like "document invalid" — they just slow things down.

> A creator can re-upload and re-submit after a rejection. Watch the rejection count — if it's been rejected 3+ times with the same issues, escalate to a full admin.

---

## Campaigns

### Viewing Campaigns

The **Campaigns** tab shows all campaigns across all statuses. Use the filter bar to narrow by status or show only flagged campaigns.

### Flagging a Campaign

Use flagging when something about a campaign needs a second look before it proceeds. Flagging pauses new contributions.

Reasons to flag:

- Goal amount seems unreasonably high for the tests requested
- The campaign description is suspicious or misleading
- A user reports the campaign as fraudulent
- The CoA was rejected multiple times and re-submitted with the same problems

How to flag:

1. Open the campaign row
2. Click **Flag**
3. Write a reason — this is stored and visible to other moderators and admins
4. Confirm

To clear a flag when the issue is resolved: open the campaign and click **Unflag**.

> Campaigns over the `auto_flag_threshold_usd` are automatically flagged. These show up in your flagged queue and need a manual review before unflagging.

### Hiding a Campaign

Hiding removes the campaign from the public feed. Use this for:

- Spam or duplicate campaigns
- Content that violates platform rules but doesn't warrant a force refund
- Test campaigns or obviously mistaken submissions with no contributions yet

1. Open the campaign row
2. Click **Hide**

To restore visibility: click **Unhide** on the same campaign.

### Force Refund

Returns all contributions to contributors instantly. This is irreversible — the campaign cannot be re-activated after a refund.

Use force refund when:

- A campaign is clearly fraudulent and contributions have already been made
- The creator has been banned and the campaign is stuck with funds in escrow
- A full admin has directed you to refund a specific campaign

1. Open the campaign row
2. Click **Force Refund**
3. Enter a reason — required, logged permanently
4. Confirm

If you're unsure whether to force refund, flag the campaign first and escalate to a full admin.

---

## Users

### Finding a User

The **Users** tab has a search bar. Search by email address or username. Results are paginated.

### User Detail Panel

Click any user row to open their detail view:

- Email, username, and account creation date
- Email verification status
- Ban status
- Active claims on their account
- Stats: total contributed, campaigns created, successful completions, refunds

### Banning a User

Banning immediately logs the user out of all sessions and prevents them from logging back in. Use this for:

- Confirmed spam accounts
- Users who have submitted fraudulent CoAs
- Accounts that are harassing other users

1. Open the user row
2. Click **Ban**
3. Optionally add a reason
4. Confirm

To unban: same flow, click **Unban**.

> You cannot ban yourself. You also cannot revoke another user's `admin` claim — only a full admin can do that.

---

## Vendors

Users can submit new vendors they've purchased from. These go into a review queue before they appear as options in campaign creation.

### Approving a Vendor

1. Find the vendor in the **Vendors** tab (filter to `pending` if needed)
2. Review the name for duplicates and accuracy
3. Click **Approve**

The vendor is now available to all users when creating campaigns.

### Rejecting a Vendor

Reject if the submission is a duplicate, misspelled, not a real peptide vendor, or otherwise unsuitable:

1. Click **Reject**
2. Enter a reason
3. Confirm

Rejected vendors remain in the system with their rejection reason visible to admins.

---

## Peptides

Same workflow as Vendors. User-submitted peptides go through review before they're available in campaign creation.

Check for:

- Duplicates (search for the peptide name before approving)
- Correct spelling and naming conventions (e.g., "BPC-157" not "bpc 157")
- Legitimate peptides only — reject anything that doesn't make sense as a testable compound

---

## Labs

You can view labs and approve pending submissions. You cannot add new labs or edit existing ones — those actions require a full admin.

### Approving a Lab

If a new lab has been added to the system:

1. Find it in the **Labs** tab
2. Review the name and country
3. Click **Approve**

Once approved, the lab appears in campaign creation for users.

---

## Tips for Staying on Top of the Queue

- **Check CoAs first** — they block campaign payouts and directly affect contributors who are waiting for results
- **Flagged campaigns second** — auto-flagged high-value campaigns need a human sign-off before they can proceed
- **Vendor/peptide queue third** — these can wait a little longer without impacting active campaigns
- When in doubt about any action, flag it and leave a note, then let a full admin make the call
- Always write useful reasons when rejecting — vague rejections waste everyone's time and delay legitimate creators
