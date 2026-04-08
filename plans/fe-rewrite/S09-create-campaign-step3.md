# S09 — CreateCampaignPage: Step 3 (Review + Confirm)

**Depends on:** S08 (Step 2 samples form must be built; `WizardFormState` and all hooks must exist)  
**Unlocks:** nothing downstream (final piece of the wizard)

---

## Purpose

Build Step 3 of the create-campaign wizard: a full summary the creator reviews before submitting. Shows payout estimate, the verification code with copy CTA, and a final confirm dialog. On success, clears the draft and navigates to the new campaign.

---

## Files to Create

```
src/pages/create-campaign/steps/
└── Step3Review.tsx                    ← NEW

src/pages/create-campaign/components/
├── ReviewSummary.tsx                  ← NEW
└── VerificationCodeBox.tsx            ← NEW
```

---

## Hooks to Use

```ts
// In src/api/hooks/useCampaigns.ts — already exists or add:
useCreateCampaign(); // mutation that posts the full payload
useVerificationCode(); // query: GET /campaigns/verification-code
```

If `useVerificationCode` doesn't exist, add it:

```ts
export function useVerificationCode() {
  return useQuery({
    queryKey: queryKeys.campaigns.verificationCode,
    queryFn: () => campaignsApi.campaignsControllerGetVerificationCode(),
    staleTime: Infinity, // code doesn't change; cache forever for this session
  });
}
```

The API returns `{ code: string }` — a system-generated 6-digit numeric string.

---

## 1. `VerificationCodeBox.tsx`

A prominent display box for the verification code.

```tsx
interface VerificationCodeBoxProps {
  code: string;
}
```

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  🔑 Your Verification Code                           │
│                                                      │
│               4 8 2 9 1 0                            │
│         (text-4xl font-extrabold tracking-widest)    │
│                                                      │
│  [ Copy code ]                          ✓ Copied!    │
│                                                      │
│  "Add this code to your product listing (website,    │
│   Telegram post, etc.) to prove this campaign is     │
│   yours. Backers use it to verify authenticity."     │
└──────────────────────────────────────────────────────┘
```

**Styling:**

- Container: `bg-amber-50 border-2 border-amber-300 rounded-xl p-5`
- Header: `text-sm font-semibold text-amber-800` with `Key` icon (lucide-react)
- Code: `text-4xl font-extrabold text-text tracking-widest text-center py-4`
- Copy button: `Button variant="secondary" size="md"` with `Copy` icon (lucide-react)
  - On click: `navigator.clipboard.writeText(code)` then briefly show `✓ Copied!` label for 2 seconds using local state
- Instruction text: `text-sm text-amber-800`

---

## 2. `ReviewSummary.tsx`

A read-only summary of everything the creator entered.

```tsx
interface ReviewSummaryProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  platformFeePercent: number; // from useAppInfo or a passed-down value
}
```

**Sections:**

### Campaign Goal

```
Title:              Test My BPC-157 Capsules
Description:        "Describe the product..." (first 100 chars, then "…")
Amount Requested:   $400.00
Lock Threshold:     70%
```

Each row: `text-sm text-text-2` label + `text-sm font-medium text-text` value. Render in a `<dl>` or stacked div.

### Estimated Costs

```
Estimated lab cost:    $280.00
Your ask:              $400.00
──────────────────────────────
Ratio:                 1.4× lab cost
```

- If ratio > 1.5: amber warning row: `⚠ Ratio exceeds 1.5×. This may delay admin approval. Consider revising your ask or explaining the gap in your description.`
  - This is the **blocker** — "Create Campaign" button is disabled when ratio > 1.5

### Payout Estimate

```
Goal amount:         $280.00   (= funding_threshold_usd)
Platform fee (5%):  −  $14.00
──────────────────────────────
You receive:         $266.00
```

Computed as: `goal × (1 − platformFeePercent / 100)`.  
`goal = parseFloat(formState.amountRequested) × (formState.fundingThresholdPercent / 100)`

### Samples

For each sample:

```
Sample 1: BPC-157 from Swisschems
  Lab:   Janoshik
  Tests: HPLC Purity, NMR Spectroscopy (2 tests)
```

- Sample label as sub-heading: `text-sm font-semibold text-text`
- Lab and test summary: `text-sm text-text-2`

---

## 3. `Step3Review.tsx`

The step orchestrator that assembles the review screen.

```tsx
interface Step3ReviewProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  onBack: () => void;
  onSuccess: (campaignId: string) => void; // navigate to new campaign
}
```

**Layout (top to bottom):**

1. `ReviewSummary` — full summary card
2. `VerificationCodeBox` — verification code prominently below the summary
3. "Create Campaign" button (`variant="primary" fullWidth size="lg"`)
4. "← Back" button (`variant="ghost"`)

**"Create Campaign" button disabled when:**

- Ratio > 1.5 (blocking validation from `ReviewSummary`)
- Mutation is in-flight (show `loading={true}` state)

**Confirmation dialog:**
On click of "Create Campaign" (when all validation passes), show a `Modal` (from `src/components/ui/Modal`) for final confirmation before submitting:

```
┌────────────────────────────────────────────────────┐
│  Create "{title}"?                                 │
│                                                    │
│  Samples and tests cannot be changed after         │
│  creation.                                         │
│                                                    │
│  Summary:                                          │
│  · N samples going to N lab(s)                     │
│  · Raise $X to unlock                              │
│                                                    │
│  [ Cancel ]              [ Create Campaign ]       │
└────────────────────────────────────────────────────┘
```

On "Create Campaign" in modal:

1. Build the API payload from `formState` (see payload shape below)
2. Call `useCreateCampaign()` mutation
3. On success: call `clearDraft()` from `useDraftStorage`, call `onSuccess(newCampaignId)` which navigates to `/campaigns/:id`
4. On error: close modal, show error toast with the server message

**API Payload Shape** (check api-client types for exact field names):

```ts
{
  title: formState.title,
  description: formState.description,
  amount_requested_usd: parseFloat(formState.amountRequested),
  funding_threshold_percent: formState.fundingThresholdPercent,
  samples: formState.samples.map(s => ({
    peptide_id: s.peptideId,
    vendor_id: s.vendorId,
    purchase_date: s.purchaseDate,
    physical_description: s.physicalDescription,
    label: s.label,
    target_lab_id: s.targetLabId,
    test_ids: s.selectedTestIds,
    claims: s.claims.map(c => ({
      type: c.type,
      label: c.label,
      value: c.value,
    })),
  })),
}
```

Always check the actual generated `api-client` types — the field names above are illustrative. Use the exact DTO field names from `packages/common/src/dtos/campaign.dto.ts`.

---

## Wiring Step3 into `CreateCampaignPage.tsx`

In the orchestrator (`src/pages/create-campaign/CreateCampaignPage.tsx`), update the step 3 render:

```tsx
const navigate = useNavigate();
const { clearDraft } = useDraftStorage();

{
  step === 3 && (
    <Step3Review
      formState={formState}
      estimatedLabCost={estimatedLabCost}
      onBack={() => setStep(2)}
      onSuccess={(campaignId) => {
        clearDraft();
        navigate(`/campaigns/${campaignId}`);
      }}
    />
  );
}
```

Also wire `Step2Samples` navigation:

```tsx
{
  step === 2 && (
    <Step2Samples
      formState={formState}
      onUpdate={(p) => setFormState((prev) => ({ ...prev, ...p }))}
      onEstimatedCostChange={setEstimatedLabCost}
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
    />
  );
}
```

---

## Acceptance Criteria

- [ ] `VerificationCodeBox` fetches real code from API; copy button works with 2-second "Copied!" feedback
- [ ] `ReviewSummary` shows all form state correctly
- [ ] Payout estimate calculates correctly using threshold percent and platform fee
- [ ] Ratio > 1.5 shows amber warning AND disables "Create Campaign" button
- [ ] Confirmation modal appears before submission; "Cancel" closes modal without submitting
- [ ] On successful creation: draft is cleared from localStorage; user is navigated to `/campaigns/:newId`
- [ ] On API error: modal closes, error toast shown, form state preserved
- [ ] "← Back" returns to Step 2 with all sample form state intact
- [ ] Zero TypeScript errors, no `any`, no hardcoded hex
