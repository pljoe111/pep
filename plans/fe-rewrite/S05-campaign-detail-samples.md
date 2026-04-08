# S05 — CampaignDetailPage: Samples Tab + COA States

**Depends on:** S04 (CampaignDetailPage shell must exist), S01 (COAStatusChip)  
**Unlocks:** S06

---

## Purpose

Build the Samples tab for the campaign detail page. This is the most complex tab because each sample card has a dynamic COA state display with distinct UI per state, plus a "Replace COA" action for rejected samples.

---

## Files to Create

```
src/pages/campaign-detail/
└── tabs/
    └── SamplesTab.tsx              ← NEW

src/pages/campaign-detail/components/
├── SampleCard.tsx                  ← NEW
└── COAStateDisplay.tsx             ← NEW
```

---

## Data Model

From `api-client`, the relevant types (verify against generated code):

```ts
// CampaignDetailDto.samples is an array of:
interface SampleDto {
  id: string;
  label: string;
  peptideName?: string;
  vendorName: string;
  physicalDescription?: string;
  targetLabName: string;
  tests: { name: string }[];
  claims: { type: string; value: string | number | boolean }[];
  coa: CoaDto | null;
}

// CoaDto:
interface CoaDto {
  id: string;
  verificationStatus: CoaVerificationStatus;
  verificationNotes?: string;
  rejectionCount: number;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

type CoaVerificationStatus =
  | 'pending'
  | 'code_found'
  | 'code_not_found'
  | 'manually_approved'
  | 'rejected';
```

These are the API-client types — always import, never redefine.

---

## 1. `SamplesTab.tsx`

```tsx
import type { CampaignDetailDto } from 'api-client';

interface SamplesTabProps {
  campaign: CampaignDetailDto;
  isCreator: boolean;
  onReplaceCoaClick: (sampleId: string) => void; // opens UploadCOASheet pre-selected
}
```

**Layout:**

- Count summary line at top: `text-sm text-text-2`: `"N samples · COAs: X/N approved"` where X = count of `manually_approved` COAs.
- For each sample in `campaign.samples`: render `<SampleCard>` with all relevant props.
- No empty state (samples always exist on a published campaign).

**COA summary logic:**

```ts
const approvedCount = campaign.samples.filter(
  (s) => s.coa?.verificationStatus === 'manually_approved'
).length;
```

---

## 2. `SampleCard.tsx`

A collapsible card for a single sample. Shows the essential info always; expands to show claims.

```tsx
import type { SampleDto } from 'api-client';

interface SampleCardProps {
  sample: SampleDto;
  isCreator: boolean;
  onReplaceCoaClick: (sampleId: string) => void;
}
```

**Always-visible section:**

```
┌─────────────────────────────────────────────────┐
│ LABEL (text-lg font-bold text-text)             │
│ Peptide: BPC-157 · Vendor: Swisschems           │  text-sm text-text-2
│ Lab: Janoshik                                   │  text-sm text-text-2
│ Tests: HPLC | NMR | ID Test                     │  text-xs text-text-3, comma-separated
│                                                 │
│ [ COAStateDisplay ]                             │
│                                                 │
│         [ Show claims ▼ ]  (chevron toggle)     │
└─────────────────────────────────────────────────┘
```

**Expanded section (claims):**

```
Claims
──────
• Purity ≥ 99%
• Identity: Pass
• Custom claim text
```

- Each claim: `text-sm text-text`
- Blue info banner at bottom of claims: `"Claims are for contributor context only — the COA is the source of truth."`

**Styling:**

- Wrap in `<Card>` from `src/components/ui/Card`
- Physical description: shown as `text-sm text-text-2 italic` if present
- "Show claims" toggle: `ChevronDown` / `ChevronUp` from lucide-react, `text-sm text-text-2`

---

## 3. `COAStateDisplay.tsx`

The visually distinct block inside `SampleCard` that shows the current COA state.

```tsx
import type { CoaDto } from 'api-client';

interface COAStateDisplayProps {
  coa: CoaDto | null;
  isCreator: boolean;
  sampleId: string;
  onReplaceClick: (sampleId: string) => void;
}
```

### State: `null` (no COA uploaded)

```
[ Clock icon ]  Awaiting Upload
                text-sm text-text-3
```

No action for contributors. Creator sees nothing special here (upload button is in CreatorActions area).

---

### State: `pending`

```
[ Clock icon ]  Pending Review
                text-sm text-text-3
```

---

### State: `code_found`

```
[ CheckCircle (teal) ]  OCR: Verification code found
                        text-sm text-teal-700
```

Informational. Not final approval.

---

### State: `code_not_found`

```
[ AlertCircle (amber) ]  OCR: Code not found — awaiting manual review
                         text-sm text-amber-700
```

Informational.

---

### State: `manually_approved`

```
[ CheckCircle (green) ]  Approved ✓
                         text-sm text-success font-medium
[ View COA → ]           ghost Button, ExternalLink icon, opens fileUrl in new tab
```

---

### State: `rejected`

This is the most detailed state. The full card:

```
┌──────────────────────────────────────────────────┐
│ ❌  COA Rejected                                  │
│                                                  │
│  Reason:                                         │
│  "Verification code not visible in the header.   │
│   Please upload the full lab report PDF."        │
│                                                  │
│  Rejection 1 of 3          (amber text if 1–2)   │
│                                                  │
│  ⚠ One more rejection will automatically         │  (only at 2/3)
│    refund all contributors.                      │
│                                                  │
│  [ Replace COA ]                                 │  (creator only)
└──────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
// Container
<div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
  {/* Header */}
  <div className="flex items-center gap-2">
    <XCircle size={18} className="text-danger flex-shrink-0" />
    <span className="text-sm font-semibold text-danger">COA Rejected</span>
  </div>

  {/* Rejection reason */}
  {coa.verificationNotes && (
    <p className="text-sm text-text">
      <span className="font-medium">Reason: </span>
      {coa.verificationNotes}
    </p>
  )}

  {/* Rejection count */}
  <p className={`text-xs font-medium ${coa.rejectionCount >= 2 ? 'text-warning' : 'text-text-3'}`}>
    Rejection {coa.rejectionCount} of 3
  </p>

  {/* Escalated warning at 2/3 */}
  {coa.rejectionCount >= 2 && (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
      <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        One more rejection will automatically refund all contributors.
      </p>
    </div>
  )}

  {/* Replace button — creator only */}
  {isCreator && (
    <Button variant="secondary" size="sm" onClick={() => onReplaceClick(sampleId)}>
      Replace COA
    </Button>
  )}
</div>
```

---

## Wiring into CampaignDetailPage

In `src/pages/campaign-detail/CampaignDetailPage.tsx` (from S04):

1. Import `SamplesTab`
2. In the tab render switch:
   ```tsx
   case 'samples':
     return (
       <SamplesTab
         campaign={campaign}
         isCreator={isCreator}
         onReplaceCoaClick={(sampleId) => {
           setUploadCoaPreSelectedSampleId(sampleId);
           setOpenSheet('upload-coa');
         }}
       />
     );
   ```
3. Add `uploadCoaPreSelectedSampleId: string | null` to orchestrator state.

---

## Acceptance Criteria

- [ ] Each sample card shows label, peptide, vendor, lab, tests list
- [ ] Claims section is hidden by default, toggle reveals it with info banner
- [ ] `null` state shows "Awaiting Upload" muted
- [ ] `pending` state shows "Pending Review"
- [ ] `code_found` shows teal indicator
- [ ] `code_not_found` shows amber indicator
- [ ] `manually_approved` shows green check + "View COA" link that opens PDF in new tab
- [ ] `rejected` state shows rejection reason, count, escalation warning at 2/3, "Replace COA" button only for creator
- [ ] "Replace COA" opens the upload sheet with the correct sample pre-selected (wired in S06)
- [ ] COA summary at top of tab shows correct approved/total count
- [ ] Zero TypeScript errors
