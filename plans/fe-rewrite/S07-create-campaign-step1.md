# S07 — CreateCampaignPage: Wizard Shell + Step 1

**Depends on:** nothing (independent)  
**Unlocks:** S08

---

## Purpose

Decompose the 1 215-line `CreateCampaignPage.tsx` into a wizard feature folder. This story builds the **scaffold** — draft recovery banner, step indicator, navigation controls — and **Step 1** (Campaign Basics form). Steps 2 and 3 are built in S08 and S09.

---

## Update `src/routes/index.tsx`

Change the `CreateCampaignPage` import to:

```ts
import CreateCampaignPage from '../pages/create-campaign/CreateCampaignPage';
```

---

## Files to Create

```
src/pages/create-campaign/
├── CreateCampaignPage.tsx           ← NEW (thin orchestrator)
├── types.ts                         ← NEW (shared wizard form types)
├── useDraftStorage.ts               ← NEW (localStorage hook)
├── components/
│   └── WizardProgress.tsx           ← NEW (step indicator)
└── steps/
    └── Step1Basics.tsx              ← NEW
```

---

## 1. `types.ts`

Defines the complete wizard form state shared across all 3 steps. Having this in one place lets S08 and S09 extend it without conflicts.

```ts
// src/pages/create-campaign/types.ts

export interface SampleForm {
  id: string; // local uuid (not from server)
  peptideId: string;
  peptideName: string;
  vendorId: string;
  vendorName: string;
  purchaseDate: string; // ISO date string
  physicalDescription: string;
  label: string;
  targetLabId: string;
  targetLabName: string;
  selectedTestIds: string[];
  claims: ClaimForm[];
}

export interface ClaimForm {
  id: string; // local uuid
  testId: string | null; // null = custom claim
  type: string;
  label: string;
  value: string;
  required: boolean;
}

export interface WizardFormState {
  // Step 1
  title: string;
  description: string;
  amountRequested: string; // string so empty input works; parse to number on submit
  fundingThresholdPercent: number; // 5–100
  // Step 2
  samples: SampleForm[];
  // Step 3 — no extra fields; review reads from above
}

export const WIZARD_DRAFT_KEY = 'peplab_campaign_draft_v2';

export const DEFAULT_FORM_STATE: WizardFormState = {
  title: '',
  description: '',
  amountRequested: '',
  fundingThresholdPercent: 70,
  samples: [],
};
```

---

## 2. `useDraftStorage.ts`

A custom hook that persists and restores the wizard form state in `localStorage`.

```ts
// src/pages/create-campaign/useDraftStorage.ts
import { WizardFormState, WIZARD_DRAFT_KEY, DEFAULT_FORM_STATE } from './types';

export function useDraftStorage() {
  function loadDraft(): WizardFormState | null {
    try {
      const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as WizardFormState) : null;
    } catch {
      return null;
    }
  }

  function saveDraft(state: WizardFormState): void {
    localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(state));
  }

  function clearDraft(): void {
    localStorage.removeItem(WIZARD_DRAFT_KEY);
  }

  return { loadDraft, saveDraft, clearDraft };
}
```

---

## 3. `WizardProgress.tsx`

Visual step indicator shown at the top of every wizard step.

```tsx
interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void; // only navigate back, not forward
}
```

**Layout:**

```
①──────────②──────────③
Goal      Samples    Review
```

- Three circles connected by lines
- Completed steps: `bg-primary text-white`
- Current step: `bg-primary text-white ring-2 ring-primary ring-offset-2`
- Future steps: `bg-border text-text-3`
- Connecting line between steps: `bg-border` normally, `bg-primary` when the left step is complete
- Labels below each circle: `text-xs text-text-3` for future, `text-xs text-text-2` for current and past
- Step numbers inside circles: `text-sm font-bold`
- Circle size: `w-8 h-8 rounded-full`
- Clicking a completed step calls `onStepClick(n)` (to allow going back)

---

## 4. `Step1Basics.tsx`

The first wizard step form.

```tsx
import type { AppInfoDto } from 'api-client'; // contains platform_fee_percent

interface Step1BasicsProps {
  formState: WizardFormState;
  estimatedLabCost: number; // passed from orchestrator; updates when tests are selected in Step 2
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onNext: () => void;
}
```

**Fields (all use `react-hook-form` via `Controller` or register — but since state is lifted, use controlled components driven by `formState` + `onUpdate`):**

### Title

- `Input` component, `min-h-[44px]`
- Label: "Campaign Title"
- Placeholder: `"e.g. Test My BPC-157 Capsules"`
- Max 200 chars; show character counter: `{title.length}/200` as `text-xs text-text-3 text-right`
- Required; error: "Title is required"

### Description

- `Textarea` component, `rows={4}`
- Label: "Description"
- Placeholder: `"Describe the product, why you want it tested, and what you hope to find out."`
- Required; error: "Description is required"

### Amount Requested

- `Input` component with `$` prefix inline on the left
- `type="number"` `min="1"` `step="0.01"`
- Label: "Amount Requested (USD)"
- Real-time guidance line below: `"Estimated lab cost: {formatUSD(estimatedLabCost)}"` in `text-sm text-text-2`
- If `estimatedLabCost > 0` and `parseFloat(amountRequested) > estimatedLabCost * 1.5`: show inline warning in amber box:
  ```
  ⚠ Your ask is N× your estimated lab costs.
  Consider reducing it or explaining the gap in your description.
  ```
  (This warning does NOT block navigation to Step 2; it blocks Step 3 — note in the UI)
- Platform fee soft note: `"Platform keeps X% on resolution."` in `text-xs text-text-3`
  - Fetch fee % from `useAppInfo()` (hook that calls `GET /app-info`) or use a constant if not available
  - If using `useAppInfo`, add a `useAppInfo` hook to `src/api/hooks/` if it doesn't exist:
    ```ts
    export function useAppInfo() {
      return useQuery({
        queryKey: queryKeys.appInfo,
        queryFn: () => appInfoApi.appInfoControllerGetAppInfo(),
      });
    }
    ```

### Funding Threshold

- A range slider + current value display
- Label: `"Lock campaign when {value}% funded"`
- `<input type="range" min={5} max={100} step={5}>` styled with Tailwind
- Value display: `text-xl font-bold text-primary` showing current percentage
- Below: explanatory text `text-xs text-text-2`: `"You can only ship samples once you lock. Locking closes new contributions."`

### Next button

- `Button variant="primary" fullWidth size="lg"`
- Label: "Next: Add Samples →"
- Disabled if `title` is empty or `description` is empty or `amountRequested` is empty/invalid
- On click: call `onNext()`

---

## 5. `CreateCampaignPage.tsx` (orchestrator)

```tsx
// State:
const [step, setStep] = useState<1 | 2 | 3>(1);
const [formState, setFormState] = useState<WizardFormState>(DEFAULT_FORM_STATE);
const [showDraftBanner, setShowDraftBanner] = useState(false);
const { loadDraft, saveDraft, clearDraft } = useDraftStorage();

// On mount: check for existing draft
useEffect(() => {
  const draft = loadDraft();
  if (draft && (draft.title || draft.samples.length > 0)) {
    setShowDraftBanner(true);
  }
}, []);

function continueDraft() {
  const draft = loadDraft();
  if (draft) setFormState(draft);
  setShowDraftBanner(false);
}

function startFresh() {
  clearDraft();
  setFormState(DEFAULT_FORM_STATE);
  setShowDraftBanner(false);
}

// Save on every state change
useEffect(() => {
  saveDraft(formState);
}, [formState]);

// Estimated lab cost: computed from Step 2 selected tests
// (Step 2 will pass this up; default to 0 here)
const [estimatedLabCost, setEstimatedLabCost] = useState(0);
```

**Draft recovery banner (shown above page content when `showDraftBanner`):**

```
┌───────────────────────────────────────────────────────┐
│  📝 You have an unfinished campaign.                  │
│  [ Continue where you left off ]  [ Start fresh ]    │
└───────────────────────────────────────────────────────┘
```

- `bg-amber-50 border border-amber-200 rounded-xl p-4`
- Two buttons side by side: "Continue" (primary ghost) and "Start Fresh" (secondary/danger)

**Render:**

```tsx
<AppShell hideBottomNav>
  <PageContainer>
    {showDraftBanner && <DraftBanner onContinue={continueDraft} onStartFresh={startFresh} />}
    <WizardProgress currentStep={step} onStepClick={(s) => { if (s < step) setStep(s); }} />
    {step === 1 && (
      <Step1Basics
        formState={formState}
        estimatedLabCost={estimatedLabCost}
        onUpdate={(p) => setFormState((prev) => ({ ...prev, ...p }))}
        onNext={() => setStep(2)}
      />
    )}
    {step === 2 && <Step2Samples ... />}   {/* wired in S08 */}
    {step === 3 && <Step3Review  ... />}   {/* wired in S09 */}
  </PageContainer>
</AppShell>
```

Note: `hideBottomNav` — the wizard should not show the BottomNav to keep the user focused.

---

## Acceptance Criteria

- [ ] Draft recovery: exist draft → banner shown on load; "Continue" restores state; "Start Fresh" clears it
- [ ] Draft saved to localStorage on every field change
- [ ] `WizardProgress` shows step 1 as active, steps 2–3 as inactive
- [ ] Clicking step 1 circle in later steps navigates back (no forward navigation via steps)
- [ ] Title character counter shows and enforces 200 char limit
- [ ] Amount field shows estimated lab cost (0.00 at this point — Step 2 feeds it back)
- [ ] Funding threshold slider shows current percentage and updates form state
- [ ] "Next" button disabled until title, description, amountRequested are filled
- [ ] `AppShell hideBottomNav` — no bottom nav visible on wizard
- [ ] Zero TypeScript errors
