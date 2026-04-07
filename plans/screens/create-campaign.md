# Screen: Create Campaign Wizard

**Route:** `/create`  
**Auth:** Required (`campaign_creator` claim)

---

## Purpose

A step-by-step wizard that collects everything needed to publish a campaign. Broken into three sequential steps so the creator is never overwhelmed. Progress is auto-saved to localStorage between sessions.

---

## Draft Recovery

If the user previously started a wizard and left without completing it, they are offered the choice to continue the draft or start fresh. Starting fresh clears the saved state.

---

## Step 1 — Campaign Basics

The creator defines the fundraising goal.

**Fields:**

| Field                     | Description                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                     | Public name of the campaign. Required.                                                                                                                                  |
| Description               | What is being tested and why. Required.                                                                                                                                 |
| Amount Requested (USD)    | How much the creator wants to raise. Required. Must be greater than zero and must not exceed 1.5× the estimated lab cost (validated once tests are selected in Step 2). |
| Funding Threshold Percent | The percentage of the requested amount that must be raised before the creator can lock the campaign. Range 5–100. Default 70.                                           |

**Guidance shown:**

- Estimated lab cost updates in real time as the user selects tests in Step 2 and returns to review Step 1.
- If the requested amount exceeds 1.5× the estimated lab cost, an inline warning is shown. The user cannot proceed to Step 3 with this condition unresolved.
- The platform fee percentage is shown so the creator understands how much of the payout they keep.

**Advancing:** All required fields must be filled and valid before the user can move to Step 2.

---

## Step 2 — Samples

The creator adds one or more physical samples to the campaign.

Each sample has three sub-sections:

### Sub-section A — What did you buy?

| Field                | Description                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Peptide              | Selected from the approved peptide catalog via a searchable combobox. If the peptide is not listed, the creator can submit a new peptide inline (approval is async; the wizard continues immediately). Required. |
| Vendor               | Selected from the vendor registry via a searchable combobox. If the vendor is not listed, the creator can submit a new vendor inline (same async pattern). Required.                                             |
| Purchase Date        | Date the product was purchased. Cannot be in the future. Required.                                                                                                                                               |
| Physical Description | Observable characteristics of the sample (e.g. form, colour, flavour). Optional.                                                                                                                                 |
| Sample Label         | Short human-readable name for this sample within the campaign. Auto-filled from peptide + vendor but editable. Required.                                                                                         |

### Sub-section B — Where is it going?

| Field      | Description                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target Lab | Which approved lab will receive and test this sample. Selected from a list of approved labs. Required.                                                                                            |
| Tests      | Checkboxes from the lab's active test menu. Each test shows its name, price, and vials required. A running total of vials needed and estimated cost is shown. At least one test must be selected. |

### Sub-section C — What are you claiming?

Claims are auto-derived from the selected tests' claim templates. They exist for contributor context only — they do not affect campaign resolution or payout. The creator is shown a notice to this effect.

- Required claims (from test templates) cannot be removed; optional claims can be.
- The creator can add custom free-text claims.
- Each claim type has the appropriate input: number, percentage, pass/fail toggle, or free text.

**Multiple samples:** The creator can add more samples. A prompt to add another sample appears once the first sample has a peptide selected.

**Multi-lab detection:** If samples are destined for different labs, the creator is informed and given the option to learn about splitting into separate campaigns (informational only — not enforced).

**Advancing:** Every sample must have a peptide, vendor, purchase date, sample label, target lab, and at least one test.

---

## Step 3 — Review & Confirm

A summary of all inputs before the campaign goes live.

**Information shown:**

- Title, description excerpt, amount requested, lock threshold percentage.
- Per-sample: label, peptide, vendor, lab, number of tests selected.
- Estimated lab cost.
- Payout estimate: (goal amount) − (platform fee) = what the creator receives on resolution.
- **Verification Code** — a system-generated 6-digit code displayed prominently with a copy button. The creator is instructed to post this code on their product listing so backers can verify the campaign is genuine.

**Confirming:** Tapping the confirm button shows a final confirmation prompt that reiterates the key summary and warns that samples and tests cannot be changed after creation. The creator must explicitly confirm before the campaign is created.

**On success:** The draft is cleared from localStorage and the user is navigated to the new campaign's detail page.

---

## Error Handling

| Situation                                  | Behaviour                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Creator balance below the platform minimum | API rejects creation with a clear error. User stays on Step 3 and is told what balance is required. |
| Selected lab no longer approved (stale)    | API rejects; user is prompted to select a different lab.                                            |
| Test not offered at the selected lab       | API rejects; user is prompted to deselect the test or change the lab.                               |
| Network failure during submission          | Error toast. Draft is preserved. User can retry.                                                    |
