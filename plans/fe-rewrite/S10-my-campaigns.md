# S10 — MyCampaignsPage Rewrite

**Depends on:** S01 (CampaignStatusBadge must exist)  
**Unlocks:** nothing downstream

---

## Purpose

Decompose `src/pages/MyCampaignsPage.tsx` (323 lines) into a feature folder. The current file mixes list rendering, modals, and mutation calls all inline. After this story, the page is a thin orchestrator delegating to focused components.

---

## Update `src/routes/index.tsx`

Change the `MyCampaignsPage` import to:

```ts
import MyCampaignsPage from '../pages/my-campaigns/MyCampaignsPage';
```

---

## Files to Create

```
src/pages/my-campaigns/
├── MyCampaignsPage.tsx                ← NEW (thin orchestrator)
└── components/
    ├── MyCampaignsFilters.tsx         ← NEW
    ├── CampaignListItem.tsx           ← NEW
    ├── EditCampaignSheet.tsx          ← NEW
    └── DeleteCampaignConfirm.tsx      ← NEW
```

---

## Hooks to Use

All from `src/api/hooks/useCampaigns.ts` (verify they exist; add if missing):

```ts
useMyCampaigns(filters: { status?: string })   // query: GET /campaigns/mine
useUpdateCampaign()                             // mutation: PATCH /campaigns/:id
useDeleteCampaign()                             // mutation: DELETE /campaigns/:id
```

If `useMyCampaigns` uses a different name in the current file, keep the existing name.

---

## 1. `MyCampaignsPage.tsx` (orchestrator)

**State:**

```ts
const [statusFilter, setStatusFilter] = useState('');
const [editTarget, setEditTarget] = useState<string | null>(null); // campaignId
const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // campaignId
```

**Layout:**

```tsx
<AppShell>
  <PageContainer>
    {/* Page heading */}
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-3xl font-bold text-text">My Campaigns</h1>
      <Button variant="primary" size="md" onClick={() => navigate('/create')}>
        + New
      </Button>
    </div>

    <MyCampaignsFilters value={statusFilter} onChange={setStatusFilter} />

    {/* Campaign list */}
    {isLoading && <Spinner />}
    {!isLoading && campaigns.length === 0 && (
      <EmptyState
        message="You haven't created any campaigns yet."
        action={{ label: 'Create your first campaign', onClick: () => navigate('/create') }}
      />
    )}
    {campaigns.map((c) => (
      <CampaignListItem
        key={c.id}
        campaign={c}
        onEdit={() => setEditTarget(c.id)}
        onDelete={() => setDeleteTarget(c.id)}
      />
    ))}

    {/* Sheets and confirms */}
    <EditCampaignSheet
      campaign={campaigns.find((c) => c.id === editTarget) ?? null}
      isOpen={editTarget !== null}
      onClose={() => setEditTarget(null)}
    />
    <DeleteCampaignConfirm
      campaign={campaigns.find((c) => c.id === deleteTarget) ?? null}
      isOpen={deleteTarget !== null}
      onClose={() => setDeleteTarget(null)}
    />
  </PageContainer>
</AppShell>
```

---

## 2. `MyCampaignsFilters.tsx`

Status filter pills for the "My Campaigns" list.

```tsx
interface MyCampaignsFiltersProps {
  value: string;
  onChange: (status: string) => void;
}
```

Pills: `All`, `Open`, `Funded`, `In Lab`, `Resolved`  
Status values: `''`, `'created'`, `'funded'`, `'samples_sent'`, `'resolved'`

Same pill styling as `FeedFilters` in S03:

- Active: `bg-primary text-white rounded-full`
- Inactive: `bg-surface border border-border text-text-2 rounded-full`
- `min-h-[36px] px-4 py-1.5 text-sm font-medium` — pills in a dense sub-header row; 36 px is acceptable for filter pills
- Wrapped in `flex gap-2 overflow-x-auto pb-1`

---

## 3. `CampaignListItem.tsx`

A single row/card in the "My Campaigns" list.

```tsx
import type { CampaignSummaryDto } from 'api-client'; // or whichever DTO the mine endpoint returns

interface CampaignListItemProps {
  campaign: CampaignSummaryDto;
  onEdit: () => void;
  onDelete: () => void;
}
```

**Layout:**

```
┌────────────────────────────────────────────────────────┐
│ [STATUS BADGE]  [Under Review badge?]                  │
│                                                        │
│ Campaign Title                   text-xl font-bold     │
│                                                        │
│ ████████████░░░░  73%            (ProgressBar)         │
│ $320 raised of $440 goal                               │
│                                                        │
│ [View] [Edit?] [Delete?]                               │
└────────────────────────────────────────────────────────┘
```

**Button rules per status:**

| status                           | View | Edit | Delete |
| -------------------------------- | ---- | ---- | ------ |
| `created`, `contributions === 0` | ✅   | ✅   | ✅     |
| `created`, `contributions > 0`   | ✅   | ✅   | ✗      |
| `funded`                         | ✅   | ✗    | ✗      |
| `samples_sent`                   | ✅   | ✗    | ✗      |
| `results_published`              | ✅   | ✗    | ✗      |
| `resolved`                       | ✅   | ✗    | ✗      |
| `refunded`                       | ✅   | ✗    | ✗      |

- "View" → `Link` to `/campaigns/:id`, `Button variant="ghost" size="sm"`
- "Edit" → calls `onEdit()`, `Button variant="secondary" size="sm"` with `Pencil` icon from lucide-react
- "Delete" → calls `onDelete()`, `Button variant="ghost" size="sm"` with `Trash2` icon, `className="text-danger hover:text-danger"`
- All action buttons `min-h-[44px]` — even though they're `size="sm"`, the row height provides enough touch area; apply `py-2.5` to achieve 44 px if needed

**Flagged indicator:** if `campaign.is_flagged_for_review`, show amber `AlertTriangle` icon (lucide-react, size 14) inline next to the title with a tooltip or `title` attribute: "Under admin review"

```tsx
<CampaignStatusBadge status={campaign.status} flaggedForReview={campaign.is_flagged_for_review} />
```

Wrap the whole card in `<Card>` with `className="mb-3"`.

---

## 4. `EditCampaignSheet.tsx`

A bottom sheet pre-filled with the campaign's title and description.

```tsx
import type { CampaignSummaryDto } from 'api-client';

interface EditCampaignSheetProps {
  campaign: CampaignSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Edit Campaign"

Title
[ Text input — pre-filled with campaign.title ]
0–200 chars

Description
[ Textarea — pre-filled with campaign.description ]

[ ℹ Samples and tests cannot be changed after creation ]

[ Save Changes ]
```

**Behaviour:**

- Use `react-hook-form` with `defaultValues` set from `campaign` (reset when campaign prop changes via `useEffect(() => reset(campaign), [campaign])` pattern)
- Character counter on title: `{watchTitle.length}/200`
- Info note: `text-xs text-text-3` with `Lock` icon (lucide-react): `"Samples and tests are locked to protect existing contributors."`
- `useUpdateCampaign()` mutation: `PATCH /campaigns/:id` with `{ title, description }`
- On success: toast `"Campaign updated"` + invalidate `queryKeys.campaigns.mine({})` + `queryKeys.campaigns.detail(id)` + `onClose()`
- Save button: `variant="primary" fullWidth size="lg"`; disabled when no changes detected (compare `formState.isDirty`)

---

## 5. `DeleteCampaignConfirm.tsx`

An inline confirmation (not a full modal — use the `Modal` component) for deleting a zero-contribution campaign.

```tsx
import type { CampaignSummaryDto } from 'api-client';

interface DeleteCampaignConfirmProps {
  campaign: CampaignSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}
```

**Modal content:**

```
Delete "{title}"?

This cannot be undone.

[ Cancel ]        [ Delete ]
                  (danger variant)
```

- Use `Modal` from `src/components/ui/Modal`
- Cancel: `Button variant="secondary"` calling `onClose()`
- Delete: `Button variant="danger"` calling `useDeleteCampaign({ campaignId: campaign.id })`
- On success: toast `"Campaign deleted"` + invalidate `queryKeys.campaigns.mine({})` + `onClose()`
- Delete button shows `loading={true}` while mutation in-flight

---

## Acceptance Criteria

- [ ] Campaign list loads correctly; spinner shown while loading
- [ ] Filter pills filter by status; "All" shows everything
- [ ] "New" button navigates to `/create`
- [ ] Campaign rows show status badge, title, progress bar, funding amounts
- [ ] Flagged campaigns show amber indicator
- [ ] "View" links to campaign detail
- [ ] "Edit" only appears for `created` status campaigns; opens `EditCampaignSheet` pre-filled
- [ ] Title character counter works in edit sheet
- [ ] Save button disabled when no changes; success toast and modal close on save
- [ ] "Delete" only appears for `created` status + zero contributions; confirm modal appears
- [ ] Confirmed delete removes campaign from list, shows success toast
- [ ] Empty state shows when no campaigns exist
- [ ] Zero TypeScript errors, no hardcoded hex
