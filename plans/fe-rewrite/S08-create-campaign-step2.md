# S08 — CreateCampaignPage: Step 2 (Samples)

**Depends on:** S07 (wizard shell, `types.ts`, `WizardFormState` must exist)  
**Unlocks:** S09

---

## Purpose

Build the Step 2 form of the create-campaign wizard. This is the most complex step: the user adds one or more sample cards, each with three sub-sections (What did you buy · Where is it going · What are you claiming). Comboboxes for peptides and vendors already exist in `src/components/wizard/` — reuse them.

---

## Files to Create

```
src/pages/create-campaign/
└── steps/
    └── Step2Samples.tsx               ← NEW (step orchestrator)

src/pages/create-campaign/components/
├── SampleFormCard.tsx                 ← NEW (per-sample collapsible card)
├── SectionA.tsx                       ← NEW (peptide · vendor · date · label)
├── SectionB.tsx                       ← NEW (lab + test selection)
└── SectionC.tsx                       ← NEW (claims)
```

## Files to Reuse (do not recreate)

```
src/components/wizard/PeptideCombobox.tsx   ← already exists
src/components/wizard/VendorCombobox.tsx    ← already exists
```

Read both files before implementing SectionA so you wire their props correctly.

---

## Hooks to Use

```ts
// src/api/hooks/useLabs.ts (already exists)
useLabs({ approvedOnly: true, activeOnly: true })   // → LabDto[]
useLabTests(labId: string)                           // → LabTestDto[] for a specific lab

// src/api/hooks/usePeptides.ts (already exists)
useActivePeptides()

// src/api/hooks/useVendors.ts (already exists)
useVendorSearch(q: string)
```

Check `src/api/hooks/useLabs.ts` — if `useLabTests(labId)` doesn't exist, add it:

```ts
export function useLabTests(labId: string) {
  return useQuery({
    queryKey: queryKeys.labs.detail(labId), // or a nested key
    queryFn: () => labsApi.labsControllerGetLabTests({ labId }),
    enabled: !!labId,
  });
}
```

---

## Types Reference

All from `src/pages/create-campaign/types.ts` (created in S07):

```ts
(SampleForm, ClaimForm, WizardFormState);
```

For generating local IDs use: `crypto.randomUUID()` (available in all modern browsers — no package needed).

---

## 1. `Step2Samples.tsx` (step orchestrator)

```tsx
interface Step2SamplesProps {
  formState: WizardFormState;
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onEstimatedCostChange: (cost: number) => void; // bubbles lab cost to page orchestrator
  onNext: () => void;
  onBack: () => void;
}
```

**Responsibilities:**

- Renders one `SampleFormCard` per sample in `formState.samples`
- Shows `"+ Add Sample"` button below all cards (only after first sample has a peptide selected)
- Computes estimated lab cost: sum of selected test prices across all samples; calls `onEstimatedCostChange` whenever `samples` changes
- Multi-lab detection: if samples have different `targetLabId` values, show an info banner:
  ```
  ℹ Your samples are going to different labs. Consider creating separate campaigns for cleaner tracking.
  ```
  Blue info box: `bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 text-sm` with `Info` icon from lucide-react
- Navigation:
  - "← Back" link/button: `variant="ghost"` calling `onBack()`
  - "Next: Review →" button: `variant="primary" fullWidth size="lg"` disabled until **every** sample has: peptideId, vendorId, purchaseDate, label, targetLabId, and at least one selectedTestId

**Adding a sample:**

```ts
function addSample() {
  const newSample: SampleForm = {
    id: crypto.randomUUID(),
    peptideId: '',
    peptideName: '',
    vendorId: '',
    vendorName: '',
    purchaseDate: '',
    physicalDescription: '',
    label: '',
    targetLabId: '',
    targetLabName: '',
    selectedTestIds: [],
    claims: [],
  };
  onUpdate({ samples: [...formState.samples, newSample] });
}
```

**Removing a sample:**

- Each `SampleFormCard` has a remove button (trash icon, `variant="ghost"`)
- Only visible when there is more than one sample (minimum 1 sample required)

**Updating a single sample:**

```ts
function updateSample(id: string, patch: Partial<SampleForm>) {
  onUpdate({
    samples: formState.samples.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  });
}
```

On mount: if `formState.samples` is empty, add one default empty sample automatically.

---

## 2. `SampleFormCard.tsx`

A collapsible card shell for one sample.

```tsx
interface SampleFormCardProps {
  sample: SampleForm;
  index: number; // 1-based display number
  onUpdate: (patch: Partial<SampleForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}
```

**Header (always visible):**

```
  Sample 1                    [Collapse ▲ / Expand ▼]   [🗑]
  BPC-157 from Swisschems     (shown when label is set; else "Untitled sample")
```

- Card title: `text-base font-semibold text-text`
- Sample label preview: `text-sm text-text-2`
- Collapse/expand state: local `useState(true)` — expanded by default for new samples
- Remove button: only rendered when `canRemove`; `variant="ghost"` with `Trash2` icon from lucide-react, `text-danger hover:text-danger`

**Sections (shown when expanded):**

1. `SectionA` — What did you buy?
2. `SectionB` — Where is it going?
3. `SectionC` — What are you claiming?

Each section has a `text-xs font-semibold uppercase tracking-wide text-text-3` heading.

---

## 3. `SectionA.tsx` (What did you buy?)

```tsx
interface SectionAProps {
  sample: SampleForm;
  onChange: (patch: Partial<SampleForm>) => void;
}
```

**Fields:**

### Peptide (combobox)

- Use `<PeptideCombobox>` from `src/components/wizard/PeptideCombobox.tsx`
- On select: `onChange({ peptideId: p.id, peptideName: p.name })` and auto-fill label if label is still empty

### Vendor (combobox)

- Use `<VendorCombobox>` from `src/components/wizard/VendorCombobox.tsx`
- On select: `onChange({ vendorId: v.id, vendorName: v.name })` and auto-fill label if still empty

### Auto-fill label

When BOTH peptide and vendor are selected and `sample.label === ''`:

```ts
onChange({ label: `${peptideName} from ${vendorName}` });
```

### Purchase Date

- `<Input type="date">` with label "Purchase Date"
- Max: today's date (`new Date().toISOString().split('T')[0]`)
- Min: 10 years ago
- Required

### Physical Description (optional)

- `<Input>` placeholder: `"White powder, gray capsules, unflavoured"`
- Optional field, no validation

### Sample Label

- `<Input>` label: "Sample Label"
- Pre-filled from auto-fill above; editable
- Required

---

## 4. `SectionB.tsx` (Where is it going?)

```tsx
interface SectionBProps {
  sample: SampleForm;
  onChange: (patch: Partial<SampleForm>) => void;
}
```

**Target Lab selector:**

- `<Select>` or styled `<select>` with `useLabs({ approvedOnly: true, activeOnly: true })`
- Option format: `"LabName (Country)"`
- On change: `onChange({ targetLabId: id, targetLabName: name, selectedTestIds: [] })` — clear test selection when lab changes
- Loading state: placeholder "Loading labs…" with `Spinner`

**Test list (shown after lab is selected):**

- `useLabTests(sample.targetLabId)` — list of tests for the selected lab
- Renders a checklist:
  ```
  ☐ HPLC Purity Test        1 vial    $150.00
  ☑ NMR Spectroscopy        2 vials   $200.00
  ☐ Identity Confirmation   1 vial     $80.00
  ─────────────────────────────────────────────
    Total: 2 vials · Estimated: $200.00
  ```
- Each row: `<label className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">`
  - Checkbox: `<input type="checkbox" className="w-5 h-5 rounded accent-primary">`
  - Test name: `text-sm text-text`
  - Vials: `text-xs text-text-3`
  - Price: `text-sm text-text font-medium text-right ml-auto`
- Running total line (below all tests): `text-sm font-semibold text-text`
- At least one test required; show error `"Select at least one test"` when next is clicked without a test selected
- Checking a test: update `selectedTestIds`; also update claims via SectionC logic (pass new test IDs up)

---

## 5. `SectionC.tsx` (What are you claiming?)

```tsx
interface SectionCProps {
  sample: SampleForm;
  selectedTestIds: string[];
  onChange: (patch: Partial<SampleForm>) => void;
}
```

**Auto-derived claims:**

- When `selectedTestIds` changes, fetch claim templates for each test using `useClaimTemplates(testId)` from `src/api/hooks/useLabs.ts` (add if missing — see below)
- Auto-populate `sample.claims` with required claims from templates; preserve any existing custom claims

Add hook if missing:

```ts
export function useClaimTemplates(testId: string) {
  return useQuery({
    queryKey: queryKeys.tests.claimTemplates(testId),
    queryFn: () => testsApi.testsControllerGetClaimTemplates({ testId }),
    enabled: !!testId,
  });
}
```

**Claim list:**
Each claim row:

```
Label: Purity    [  99%  ]   [−] (minus only on optional claims)
```

- Required claims: no remove button
- Optional claims: `Minus` icon button (lucide-react)
- Claim value input type depends on `claim.type`:
  - `'number'` → `<Input type="number">`
  - `'percent'` → `<Input type="number" min=0 max=100>` with `%` suffix
  - `'boolean'` → `<select>` with "Pass / Fail" options
  - `'text'` → `<Input>`

**"+ Add Custom Claim" button:**

- `variant="ghost"` with `Plus` icon
- Appends a new `ClaimForm` with `testId: null, type: 'text', required: false`
- Custom claim row also has a label input

**Info banner (always shown):**

```
ℹ Claims are for contributor context only. The COA is the source of truth.
```

`bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 text-sm`

---

## Acceptance Criteria

- [ ] Starts with one empty sample card open
- [ ] PeptideCombobox and VendorCombobox wire correctly; selecting both auto-fills label
- [ ] Purchase date cannot be in the future
- [ ] Lab selector loads from API; changing lab clears test selection
- [ ] Test checklist shows prices and vials; running total updates
- [ ] Claims auto-populate from test templates when tests are selected
- [ ] Required claims cannot be removed; optional claims can
- [ ] "Next" button disabled until all samples are complete
- [ ] "+ Add Sample" appears after first sample has peptide selected
- [ ] Sample can be removed if there are ≥ 2 samples
- [ ] Multi-lab banner appears when samples target different labs
- [ ] Estimated lab cost bubbles up to orchestrator (Step 1 shows it)
- [ ] Zero TypeScript errors, no `any`, no hardcoded hex
