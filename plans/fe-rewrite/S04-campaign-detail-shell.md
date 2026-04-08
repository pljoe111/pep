# S04 — CampaignDetailPage: Shell + Tabs Structure

**Depends on:** S01 (CampaignStatusBadge, FundingCard, ReactionBar)  
**Unlocks:** S05, S06

---

## Purpose

Decompose the 1 077-line `CampaignDetailPage.tsx` into a feature folder. This story builds the **skeleton**: the page orchestrator, the hero section, the funding card, and four of the five tabs (Overview, Results, Updates, Backers). The Samples tab (complex, COA-aware) is built in S05. All action sheets (Contribute, Lock, Ship, Upload COA) are wired in S06.

---

## Current File to Replace

`src/pages/CampaignDetailPage.tsx` — **replace** by re-exporting from the new folder.

---

## Files to Create

```
src/pages/campaign-detail/
├── CampaignDetailPage.tsx              ← NEW (thin orchestrator)
├── components/
│   ├── CampaignHero.tsx                ← NEW
│   └── CreatorActions.tsx              ← NEW (action button area, sheets wired in S06)
└── tabs/
    ├── OverviewTab.tsx                 ← NEW
    ├── ResultsTab.tsx                  ← NEW
    ├── UpdatesTab.tsx                  ← NEW
    └── BackersTab.tsx                  ← NEW
```

## Update `src/routes/index.tsx`

Change the `CampaignDetailPage` import to:

```ts
import CampaignDetailPage from '../pages/campaign-detail/CampaignDetailPage';
```

---

## Hooks Reference

All hooks are already in `src/api/hooks/useCampaigns.ts`. This story uses:

```ts
useCampaignDetail(id: string)         // → CampaignDetailDto
useCampaignReactions(id: string)      // → CampaignReactionDto[]
useCampaignUpdates(id: string)        // → CampaignUpdateDto[]
useCampaignContributions(id: string)  // → ContributionDto[]
useCampaignCoas(id: string)           // → CoaDto[]
useWalletBalance()                    // needed for contribute sheet (S06)
```

Types: always import from `api-client`.

---

## 1. `CampaignDetailPage.tsx` (orchestrator)

**Responsibilities:**

- Extract `id` from `useParams()`
- Call `useCampaignDetail(id)`
- Manage which sheet is open (local state: `null | 'contribute' | 'lock' | 'ship' | 'upload-coa' | 'post-update'`)
- Render loading skeleton (if `isLoading`): full-page spinner centered
- Render error state (if `isError`): `EmptyState` with "Campaign not found" + back button
- Render hidden-campaign guard: if campaign is not found or `is_hidden` and user is not admin → `EmptyState` with "Campaign not found"
- Render `CampaignHero` + `FundingCard` (from S01) + `ReactionBar` (from S01) + `Tabs` + `CreatorActions`
- Pass sheet open/close callbacks down through `CreatorActions`

**Tab order and labels:**

```ts
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'samples', label: 'Samples' },
  { key: 'results', label: 'Results' },
  { key: 'updates', label: 'Updates' },
  { key: 'backers', label: 'Backers' },
];
```

Active tab state: `useState<string>('overview')`.

**Sticky Contribute CTA:**
When the viewer is authenticated, not the campaign creator, and the campaign status is `created` (non-flagged):

```tsx
<div className="fixed bottom-[calc(env(safe-area-inset-bottom)+64px)] left-0 right-0 px-4 pb-2 z-30">
  <Button variant="primary" fullWidth size="lg" onClick={() => setOpenSheet('contribute')}>
    Contribute
  </Button>
</div>
```

The `64px` accounts for the BottomNav height so the button sits above it.

---

## 2. `CampaignHero.tsx`

```tsx
import type { CampaignDetailDto } from 'api-client';

interface CampaignHeroProps {
  campaign: CampaignDetailDto;
}
```

**Layout:**

```
[ STATUS BADGE ] [ Under Review badge? ]

Campaign Title
                                     text-3xl font-bold text-text

Created by @username · N resolved campaigns
                                     text-sm text-text-2

[ ⚠ Orange banner: "This campaign is under admin review. Contributions are paused." ]
   (only when is_flagged_for_review)

[ 🔴 Red banner: "This campaign has been refunded. Reason: X" ]
   (only when status === 'refunded' and refund_reason exists)
```

**Props to render:**

- `CampaignStatusBadge` from S01 with `status` and `flaggedForReview={campaign.is_flagged_for_review}`
- Title: `text-3xl font-bold text-text`
- Creator line: link to `/users/:creatorId` page; show `@{username}` and `{N} successfully resolved campaigns` using `resolvedCampaignCount` from the DTO
- Flagged banner: `bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm` with `AlertTriangle` icon from lucide-react
- Refunded banner: `bg-red-50 border border-red-200 text-danger rounded-xl p-3.5 text-sm` with `AlertCircle` icon

---

## 3. `CreatorActions.tsx`

Visible **only** when `campaign.creatorId === currentUser.id`.

```tsx
interface CreatorActionsProps {
  campaign: CampaignDetailDto;
  onOpenSheet: (sheet: 'lock' | 'ship' | 'upload-coa' | 'post-update') => void;
}
```

**What to show per status:**

| status              | Actions shown                                        |
| ------------------- | ---------------------------------------------------- |
| `created`           | Lock Campaign button                                 |
| `funded`            | Ship Samples button, Upload COA button               |
| `samples_sent`      | Upload COA button, Post Update button                |
| `results_published` | Post Update button + payout preview card (see below) |
| `resolved`          | Post Update button                                   |

**Payout preview card** (shown when status = `results_published`):

```
Escrow balance:      $480.00
Platform fee (5%):  − $24.00
────────────────────────────
You receive:         $456.00

"An admin is reviewing your resolution. You'll be notified when funds are credited."
```

Use `formatUSD` from `src/lib/formatters`. Fee percentage comes from `campaign.platform_fee_percent` (if available on DTO) — fall back to a `GET /admin/config` value or just display it from the campaign DTO.

**Button styles:**

- "Lock Campaign" → `variant="secondary"` with `Lock` icon (lucide-react)
- "Ship Samples" → `variant="secondary"` with `Package` icon
- "Upload COA" → `variant="secondary"` with `Upload` icon
- "Post Update" → `variant="ghost"` with `MessageSquare` icon
- All `size="md"` (44 px min-height)

Wrap in a `Card` with label "Creator Actions" as a `text-xs font-medium text-text-3 uppercase tracking-wide` heading.

---

## 4. `OverviewTab.tsx`

```tsx
interface OverviewTabProps {
  campaign: CampaignDetailDto;
}
```

- Campaign description in full (`text-base text-text whitespace-pre-wrap`)
- If `campaign.cost_breakdown` exists and is an array of `{ label, amount }`, render an itemised table below the description:

```
  Lab testing (3 tests)    $350.00
  Shipping supplies          $30.00
  ───────────────────────────────
  Total                    $380.00
```

- If neither exists or both are empty: `EmptyState` with "No description provided"

---

## 5. `ResultsTab.tsx`

```tsx
interface ResultsTabProps {
  campaignId: string;
}
```

- Uses `useCampaignCoas(campaignId)` hook
- Shows loading spinner while fetching
- Each COA: `Card` row containing:
  - File name (`text-sm font-medium text-text`)
  - Upload date (`text-xs text-text-3`, use `formatDate` from formatters)
  - `COAStatusChip` from S01
  - "View PDF" → `<a href={coa.fileUrl} target="_blank">` — `Button` variant `ghost` size `sm` with `ExternalLink` icon from lucide-react
- Empty state (no COAs yet): `EmptyState` with "Results will appear here once COAs are uploaded"

---

## 6. `UpdatesTab.tsx`

```tsx
interface UpdatesTabProps {
  campaignId: string;
}
```

- Uses `useCampaignUpdates(campaignId)` hook
- Each update in reverse-chronological order:

  ```
  ┌──────────────────────────────────────┐
  │  @username        3 days ago         │
  │  Update text...                      │
  └──────────────────────────────────────┘
  ```

  - Author: `text-sm font-medium text-text`
  - Timestamp: `text-xs text-text-3`
  - Content: `text-sm text-text whitespace-pre-wrap`
  - Each update wrapped in a `<div className="border-b border-border py-4 last:border-b-0">`

- Empty state: "No updates posted yet"

---

## 7. `BackersTab.tsx`

```tsx
interface BackersTabProps {
  campaignId: string;
  currentUserId?: string; // to highlight "my" contribution
}
```

- Uses `useCampaignContributions(campaignId)` hook
- Each row:

  ```
  @username           $50.00   Jan 15, 2025
  ```

  - Username links to `/users/:userId`
  - Amount: `text-sm font-medium text-text`
  - Date: `text-xs text-text-3`
  - If this row's `userId === currentUserId`: row gets `border-l-2 border-primary pl-3 bg-primary-l/30` highlight
  - If contribution is refunded: amount struck through + `(refunded)` in `text-text-3`

- Empty state: "No backers yet — be the first to contribute"

---

## Acceptance Criteria

- [ ] Campaign detail page loads and shows all 5 tabs via the `Tabs` component
- [ ] `CampaignHero` shows correct title, creator, status badge
- [ ] Flagged campaign shows amber warning banner; no contribute button shown
- [ ] Refunded campaign shows red refund reason banner
- [ ] `CreatorActions` appears only for the campaign creator
- [ ] Payout preview shows when status = `results_published`
- [ ] Overview tab renders description; Results tab shows COA list; Updates and Backers tabs render correctly
- [ ] Sticky Contribute CTA appears above BottomNav for eligible contributors
- [ ] Zero TypeScript errors, no `any`, no hardcoded hex
