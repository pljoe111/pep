# S01 — Shared Campaign Display Components

**Depends on:** nothing (foundation story — do this first)
**Unlocks:** S03, S04, S05, S10

---

## Purpose

Build the campaign-specific display primitives that will be shared across every user-facing page. Write all five files from scratch — do not read or preserve any existing code.

---

## Context (do not read the files — just use these facts)

- `src/lib/badgeUtils.ts` exports `campaignStatusVariant(status)` and `campaignStatusLabel(status)`. Import from there; do not delete that file.
- The old `src/components/campaigns/CampaignCard.tsx` is already deleted (Step 0 in S00). Write it fresh.

---

## Files to Create (all new)

```
src/components/campaigns/
├── CampaignStatusBadge.tsx   ← NEW
├── COAStatusChip.tsx         ← NEW
├── FundingCard.tsx           ← NEW
├── ReactionBar.tsx           ← NEW
└── CampaignCard.tsx          ← NEW (old file deleted)
```

---

## Component Specs

### 1. `CampaignStatusBadge.tsx`

**Purpose:** Single place that maps a campaign status string to the right Badge variant and human label.

```tsx
// Props
interface CampaignStatusBadgeProps {
  status: string; // CampaignStatus from api-client
  flaggedForReview?: boolean;
  className?: string;
}
```

**Behaviour:**

- Import `Badge` from `src/components/ui/Badge`
- Import `campaignStatusVariant`, `campaignStatusLabel` from `src/lib/badgeUtils`
- Render the primary status Badge
- If `flaggedForReview` is true, render a second amber Badge saying "Under Review" inline next to the status badge (wrap both in a `flex gap-1` span)
- No min-height requirement — this is a display-only component

**Status → variant mapping** (mirrors `badgeUtils.ts`):

| status              | Badge variant | label       |
| ------------------- | ------------- | ----------- |
| `created`           | `amber`       | Open        |
| `funded`            | `blue`        | Funded      |
| `samples_sent`      | `purple`      | In Lab      |
| `results_published` | `indigo`      | Results Out |
| `resolved`          | `green`       | Resolved    |
| `refunded`          | `red`         | Refunded    |
| anything else       | `gray`        | Unknown     |

---

### 2. `COAStatusChip.tsx`

**Purpose:** Shows the current COA verification state for a single sample. Used in the Samples tab and on sample cards.

```tsx
// Import the COA status type from api-client
import type { CoaVerificationStatus } from 'api-client';

interface COAStatusChipProps {
  status: CoaVerificationStatus | null; // null = not yet uploaded
  rejectionCount?: number; // shown when status === 'rejected'
  className?: string;
}
```

**State → display mapping:**

| status              | Icon (lucide-react) | Badge variant | Label               |
| ------------------- | ------------------- | ------------- | ------------------- |
| `null`              | `Clock`             | `gray`        | Awaiting Upload     |
| `pending`           | `Clock`             | `gray`        | Pending Review      |
| `code_found`        | `CheckCircle`       | `teal`        | OCR: Code Found     |
| `code_not_found`    | `AlertCircle`       | `amber`       | OCR: Code Not Found |
| `manually_approved` | `CheckCircle`       | `green`       | Approved            |
| `rejected`          | `XCircle`           | `red`         | Rejected            |

- When `status === 'rejected'` and `rejectionCount` is provided, append e.g. `(2/3)` to the label in the same chip.
- Render as `<span className="inline-flex items-center gap-1 ...">` — not a full Badge component, styled inline with Tailwind to allow the icon + text combination.
- Icon size: `size={14}` (14 px stroke icon)
- Text: `text-xs font-medium`

---

### 3. `FundingCard.tsx`

**Purpose:** The funding progress block shown on the campaign detail page. Standardises the display of progress bar + amounts + time remaining + platform fee disclosure.

```tsx
import type { CampaignDetailDto } from 'api-client';

interface FundingCardProps {
  campaign: CampaignDetailDto;
  myContribution?: number | null; // shown as teal pill if > 0
}
```

**What to render (top to bottom):**

1. **Progress bar** — `ProgressBar` from `src/components/ui/ProgressBar`, fill percentage = `(current_funding_usd / funding_threshold_usd) * 100`, capped at 100.
2. **Amount row** — `$X raised of $Y goal` (use `formatUSD` from `src/lib/formatters`). Right-aligned: percentage funded.
3. **Total requested** — smaller text below: `Total requested: $Z` — explains the difference between threshold and total if they differ.
4. **Time remaining** — only shown when status === `created`. Uses `formatTimeRemaining` from `src/lib/formatters`.
5. **Platform fee** — `text-text-3 text-xs`: `Platform fee: X% on resolution`.
6. **My contribution pill** — if `myContribution` is provided and > 0, show a teal `bg-primary-l text-primary text-xs font-medium rounded-full px-3 py-0.5` pill: `You contributed $X`.

Wrap everything in `<Card>` from `src/components/ui/Card`.

---

### 4. `ReactionBar.tsx`

**Purpose:** Row of 5 emoji reactions (👍 🚀 🙌 😤 🔥) with tap-to-toggle. Extracted from `CampaignDetailPage.tsx`.

```tsx
import type { CampaignReactionDto, ReactionType } from 'api-client';

interface ReactionBarProps {
  campaignId: string;
  reactions: CampaignReactionDto[]; // current reaction counts + my reaction
  isAuthenticated: boolean;
  isOwner: boolean; // owner cannot react to own campaign
}
```

**Behaviour:**

- Pull `useAddReaction`, `useRemoveReaction` from `src/api/hooks/useCampaigns`
- Render 5 buttons in a horizontal scroll row (`flex gap-2 overflow-x-auto`)
- Each button: `rounded-full border border-border px-3 py-1.5 text-sm min-h-[36px]` (36 px — dense row, acceptable exception documented)
- If the current user has reacted with that type: `bg-primary-l border-primary text-primary`
- Unauthenticated or owner: buttons are non-interactive (no hover states, `cursor-default`)
- Show reaction count next to emoji
- On tap: if already reacted → call `useRemoveReaction`; else → call `useAddReaction`

Reaction type order: `thumbs_up`, `rocket`, `praising_hands`, `mad`, `fire`  
Emoji map:

```ts
const EMOJI: Record<ReactionType, string> = {
  thumbs_up: '👍',
  rocket: '🚀',
  praising_hands: '🙌',
  mad: '😤',
  fire: '🔥',
};
```

---

### 5. `CampaignCard.tsx` (write from scratch — old file deleted)

Write the complete card using `<CampaignStatusBadge>` and `<ProgressBar>`. The old file is gone; do not try to preserve anything from it.

**Card content checklist:**

- [ ] Campaign title (`text-xl font-bold text-text`)
- [ ] Creator username (`text-sm text-text-2`)
- [ ] `CampaignStatusBadge` with `flaggedForReview` prop wired
- [ ] `ProgressBar` (fill = `currentFunding / threshold * 100`, cap 100)
- [ ] `$X raised of $Y goal` + `%` funded
- [ ] Time remaining (only when status === `created`)
- [ ] Vendor name(s) and lab name(s) as small `text-xs text-text-3` tags
- [ ] Sample labels (up to 2, then `+N more` if needed)
- [ ] Entire card is a `Link` to `/campaigns/:id`
- [ ] `min-h-[44px]` on the card Link wrapper (already satisfies because the card itself is tall)

---

## Acceptance Criteria

- [ ] All 4 new files compile with zero TypeScript errors
- [ ] `CampaignCard.tsx` compiles and the campaign feed (`HomePage`) still renders without visual regressions
- [ ] `COAStatusChip` correctly shows null state as "Awaiting Upload" gray
- [ ] `FundingCard` renders a progress bar capped at 100 % even when `current_funding_usd > funding_threshold_usd`
- [ ] `ReactionBar` buttons fire correct mutations and update counts optimistically
- [ ] No hardcoded hex values anywhere in these files
- [ ] No new external packages introduced
