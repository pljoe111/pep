# S06 — CampaignDetailPage: Action Sheets

**Depends on:** S05 (Samples tab + COA state must be built)  
**Unlocks:** nothing downstream (final piece of campaign detail)

---

## Purpose

Build all the bottom-sheet action flows for the campaign detail page. These were previously all inline in `CampaignDetailPage.tsx`. Each sheet is a focused, self-contained component.

---

## Files to Create

```
src/pages/campaign-detail/sheets/
├── ContributeSheet.tsx          ← NEW
├── LockCampaignSheet.tsx        ← NEW
├── ShipSamplesSheet.tsx         ← NEW
├── UploadCOASheet.tsx           ← NEW
└── PostUpdateSheet.tsx          ← NEW
```

---

## Hooks Used

All from `src/api/hooks/useCampaigns.ts` (already exist):

```ts
useContribute(); // mutation
useLockCampaign(); // mutation
useShipSamples(); // mutation
useUploadCoa(); // mutation
useAddCampaignUpdate(); // mutation
```

From `src/api/hooks/useWallet.ts`:

```ts
useWalletBalance(); // query
```

All sheets use `useToast()` from `src/hooks/useToast` for success/error notifications.

---

## 1. `ContributeSheet.tsx`

```tsx
interface ContributeSheetProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Contribute"

Your balance: $240.00          (text-2xl font-bold text-text)

[ $10 ] [ $25 ] [ $50 ] [ $100 ]   (quick-select chips)

┌─────────────────────────────┐
│ $  [ amount input          ]│
└─────────────────────────────┘

[ Contribute ]    (primary button, full-width, disabled if amount empty/0/> balance)
```

**Behaviour:**

- `useWalletBalance()` to show current balance at top
- Quick-select chips: `rounded-full border border-border px-4 py-2 text-sm min-h-[44px]`; selected chip: `bg-primary text-white border-primary`
- Amount input: `type="number"` min `0.01`, `step="0.01"; prefix `$` inside the input wrapper
- Tapping a chip sets the amount and marks that chip active
- Typing in the input deselects all chips
- Validation: amount must be > 0 and ≤ balance. If amount > balance, show inline error: `"Insufficient balance"` in `text-danger text-sm`
- On submit: call `useContribute({ campaignId, amount })`, show success toast, call `onClose()`, invalidate campaign detail query and wallet balance query
- Loading state: `Button loading={true}` disables interaction
- Format balance using `formatUSD` from `src/lib/formatters`

---

## 2. `LockCampaignSheet.tsx`

```tsx
interface LockCampaignSheetProps {
  campaign: CampaignDetailDto;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Lock Campaign"

Requirements checklist:
  ✅ Funding threshold met   ($320 raised of $280 required)
  ❌ Campaign not under review

Current funding summary:
  Raised: $320.00
  Goal:   $280.00 (70%)

⚠ Warning: Locking closes contributions. This cannot be undone.

[ Lock Campaign ]   (primary, disabled if any requirement fails)
```

**Requirement checks:**

1. `fundingMet`: `campaign.current_funding_usd >= campaign.funding_threshold_usd`
2. `notFlagged`: `!campaign.is_flagged_for_review`

Each requirement renders as:

```tsx
<div className="flex items-center gap-2">
  {met ? (
    <CheckCircle size={16} className="text-success" />
  ) : (
    <XCircle size={16} className="text-danger" />
  )}
  <span className={`text-sm ${met ? 'text-text' : 'text-danger'}`}>{label}</span>
</div>
```

If `!notFlagged`, add sub-text: `"Contact support to clear the review flag before locking."`

**Button state:**

- Disabled when any requirement fails: `disabled={!fundingMet || !notFlagged}`
- When disabled: button text changes to `"Requirements not met"`
- `useLockCampaign()` mutation; on success: toast `"Campaign locked"` + invalidate campaign detail + `onClose()`

---

## 3. `ShipSamplesSheet.tsx`

```tsx
interface ShipSamplesSheetProps {
  campaign: CampaignDetailDto;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Confirm Sample Shipment"

"Confirm that you have physically shipped all samples to the lab."

Lab addresses:
  ┌─────────────────────────────────────────┐
  │ Sample: BPC-157 from Swisschems         │
  │ Lab: Janoshik                           │
  │ Address: Na Pankráci 1724/129...        │
  └─────────────────────────────────────────┘
  (one card per unique lab across all samples)

⚠ Once confirmed, the 21-day results window begins.

[ I have shipped all samples — Confirm ]
```

**Behaviour:**

- Group samples by `targetLabId` to avoid duplicate lab addresses
- Render lab name + address from `sample.targetLabAddress` (or equivalent field in DTO — check api-client)
- Warning box: `bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800` with `AlertTriangle` icon
- `useShipSamples({ campaignId })` on confirm; success toast + invalidate + `onClose()`
- Confirm button: `variant="primary"` full-width, long label: `"I've shipped all samples — Confirm"`

---

## 4. `UploadCOASheet.tsx`

Used for both initial upload and replace (after rejection).

```tsx
interface UploadCOASheetProps {
  campaign: CampaignDetailDto;
  preSelectedSampleId?: string | null; // pre-selects sample when replacing a rejected COA
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Upload COA"

Select sample:
  [ BPC-157 from Swisschems ▼ ]   (dropdown / select)
  (only samples without approved COA, or with rejected COA, are selectable)

[ Rejection reason shown here if selected sample has a rejected COA ]

Select PDF file:
  [ Choose file ]
  Selected: lab-report.pdf (124 KB)

Progress bar during upload (0–100%)

[ Upload ]   (disabled until file selected)
```

**Behaviour:**

- Sample selector: `<Select>` component; options = samples where `coa === null || coa.verificationStatus === 'rejected'`; if `preSelectedSampleId` is set, default to that sample and show the rejection context above the file picker
- Rejection context (when pre-selected sample has a rejected COA):
  ```
  [Red box]
  ❌ Previous rejection reason: "..."
  Rejection N of 3
  ```
- File input: `<input type="file" accept=".pdf">` — styled as a secondary button that reads "Choose PDF" with `Paperclip` icon; after selection, show file name + size below in `text-sm text-text-2`
- Upload progress: `ProgressBar` from `src/components/ui/ProgressBar` — shown while uploading
- `useUploadCoa()` mutation call with `{ campaignId, sampleId, file }`
- Success: toast `"COA uploaded — pending admin review"` + invalidate campaign coas + invalidate campaign detail + `onClose()`
- Error: toast with error message; file input is reset

---

## 5. `PostUpdateSheet.tsx`

```tsx
interface PostUpdateSheetProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Post Update"

┌────────────────────────────────────────────────────┐
│ What would you like to share with your backers?   │
│                                                    │
│ (Textarea, min 3 rows, max 1000 chars)             │
│                                          0/1000    │
└────────────────────────────────────────────────────┘

[ Post Update ]   (primary, disabled if empty)
```

**Behaviour:**

- `Textarea` from `src/components/ui/Textarea`; `react-hook-form` for form state
- Character count below textarea: `text-xs text-text-3 text-right`
- Validation: required, min length 10, max length 1000
- `useAddCampaignUpdate({ campaignId, content })` on submit
- Success: toast `"Update posted"` + invalidate campaign updates + `onClose()`

---

## Wiring in `CampaignDetailPage.tsx`

After S06, update `src/pages/campaign-detail/CampaignDetailPage.tsx` to:

1. Import all 5 sheets
2. Render them below the main content, controlled by `openSheet` state:

```tsx
<ContributeSheet
  campaignId={campaign.id}
  isOpen={openSheet === 'contribute'}
  onClose={() => setOpenSheet(null)}
/>
<LockCampaignSheet
  campaign={campaign}
  isOpen={openSheet === 'lock'}
  onClose={() => setOpenSheet(null)}
/>
<ShipSamplesSheet
  campaign={campaign}
  isOpen={openSheet === 'ship'}
  onClose={() => setOpenSheet(null)}
/>
<UploadCOASheet
  campaign={campaign}
  preSelectedSampleId={uploadCoaPreSelectedSampleId}
  isOpen={openSheet === 'upload-coa'}
  onClose={() => { setOpenSheet(null); setUploadCoaPreSelectedSampleId(null); }}
/>
<PostUpdateSheet
  campaignId={campaign.id}
  isOpen={openSheet === 'post-update'}
  onClose={() => setOpenSheet(null)}
/>
```

3. Pass `onOpenSheet` to `CreatorActions` so the creator buttons trigger the right sheets
4. Pass `onReplaceCoaClick` from `SamplesTab` up to the orchestrator which bridges to `UploadCOASheet`

---

## Acceptance Criteria

- [ ] ContributeSheet: quick-select chips, amount input, balance shown, disabled when > balance, success toast on submit
- [ ] LockCampaignSheet: requirement checklist, button disabled when requirements fail, success toast on submit
- [ ] ShipSamplesSheet: lab addresses shown, warning box present, success toast on submit
- [ ] UploadCOASheet: sample dropdown, rejection context shown for pre-selected rejected sample, file picker, progress bar during upload, success toast
- [ ] PostUpdateSheet: textarea with character counter, validation, success toast
- [ ] All sheets close on successful mutation
- [ ] All sheets show `loading` spinner on their primary button while mutation is in-flight
- [ ] Zero TypeScript errors, no hardcoded hex
