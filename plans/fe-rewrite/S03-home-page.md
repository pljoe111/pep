# S03 — HomePage Rewrite

**Depends on:** S01 (CampaignCard + CampaignStatusBadge must exist)  
**Unlocks:** nothing downstream

---

## Purpose

Decompose the current `src/pages/HomePage.tsx` (185 lines, but all logic inline) into a proper feature folder. Add the missing filter/sort/search bar and confirm infinite scroll is working correctly.

---

## Current State

`src/pages/HomePage.tsx` — reads campaigns, renders a list with a basic filter. The filter/sort/search bar is partially implemented. Infinite scroll exists but pagination state is mixed with display logic.

**Replace** `src/pages/HomePage.tsx` with a thin orchestrator that imports from the feature folder.

---

## Files to Create

```
src/pages/home/
├── HomePage.tsx                  ← NEW (thin orchestrator, replaces old file)
└── components/
    ├── FeedFilters.tsx           ← NEW
    └── CampaignFeed.tsx          ← NEW
```

## Update `src/routes/index.tsx`

Change the `HomePage` import to:

```ts
import HomePage from '../pages/home/HomePage';
```

---

## 1. `FeedFilters.tsx`

A horizontal filter bar shown at the top of the home feed.

```tsx
interface FeedFiltersProps {
  status: string;
  search: string;
  sort: string;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: string) => void;
}
```

**Layout (top to bottom):**

### Search row

A full-width search input with a `Search` icon (lucide-react) on the left inside the input.

```
[ 🔍  Search campaigns...         ]
```

- Use `Input` from `src/components/ui/Input` or style a plain `<input>` with the icon
- `min-h-[44px]`
- `onChange` calls `onSearchChange` with debounced value (use `useDebounce` from `src/hooks/useDebounce` with 300 ms delay — call the debounced value in the `useCampaigns` query, but pass the raw value to the input for responsiveness)
- Clear button (`X` icon from lucide-react) appears when search is non-empty

### Status filter pills (horizontal scroll)

```
[ All ] [ Open ] [ Funded ] [ In Lab ] [ Results Out ] [ Resolved ]
```

- Rendered as `<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">`
- Each pill: `<button className="flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium min-h-[36px] ...">`
  - Active: `bg-primary text-white`
  - Inactive: `bg-surface border border-border text-text-2 hover:bg-surface-a`
- Status values: `''` (All), `'created'`, `'funded'`, `'samples_sent'`, `'results_published'`, `'resolved'`
- Labels: All, Open, Funded, In Lab, Results Out, Resolved

### Sort select

A right-aligned `<Select>` (from `src/components/ui/Select`) or a styled `<select>`:

```
Sort: [ Newest ▼ ]
```

- Options: `newest` → "Newest", `ending_soon` → "Ending Soon", `most_funded` → "Most Funded", `least_funded` → "Least Funded"
- Positioned inline after the status pills or on its own row — whichever fits the 375 px mobile layout

---

## 2. `CampaignFeed.tsx`

The infinite-scroll list of campaign cards.

```tsx
interface CampaignFeedProps {
  status: string;
  search: string;
  sort: string;
}
```

**Behaviour:**

- Import `useCampaignsFeed` from `src/api/hooks/useCampaigns` — this should be an **infinite query** (`useInfiniteQuery`). If it doesn't already exist as infinite, add it to the hooks file (the hook reads paginated campaigns from `campaignsControllerGetCampaigns`).
- Use an `IntersectionObserver` on a sentinel `<div ref={sentinelRef}>` at the bottom of the list to automatically trigger `fetchNextPage()` when the sentinel enters the viewport.
- While loading the first page: show 3 skeleton cards (`animate-pulse bg-surface rounded-xl h-48`)
- While loading more pages: show a `Spinner` below the last card
- **Error state:** `EmptyState` with message "Failed to load campaigns" and a "Try again" button calling `refetch()`
- **Empty - no filter match:** `EmptyState` with message "No campaigns match your filters" and a "Clear filters" button
- **Empty - feed completely empty:** `EmptyState` with message "No campaigns yet" and a "Create the first one" button linking to `/create`
- Render `<CampaignCard>` for each campaign, imported from `src/components/campaigns/CampaignCard`

**Infinite query setup (add to `src/api/hooks/useCampaigns.ts` if not present):**

```ts
export function useCampaignsFeed(filters: { status?: string; search?: string; sort?: string }) {
  return useInfiniteQuery({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      campaignsApi.campaignsControllerGetCampaigns({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    staleTime: 300_000,
  });
}
```

---

## 3. `HomePage.tsx` (new thin orchestrator)

```tsx
// src/pages/home/HomePage.tsx

export default function HomePage(): React.ReactElement {
  // URL search params for filter/sort/search state (persisted in URL)
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const search  = searchParams.get('search')  ?? '';
  const sort    = searchParams.get('sort')    ?? 'newest';

  // helpers to update individual params without losing others
  function set(key: string, value: string) { ... }

  return (
    <AppShell>
      <PageContainer>
        <FeedFilters
          status={status}
          search={search}
          sort={sort}
          onStatusChange={(v) => set('status', v)}
          onSearchChange={(v) => set('search', v)}
          onSortChange={(v) => set('sort', v)}
        />
        <CampaignFeed status={status} search={search} sort={sort} />
      </PageContainer>
    </AppShell>
  );
}
```

Filter state lives in URL search params (`useSearchParams` from React Router) so links are shareable and page refresh restores context.

---

## Route Update

In `src/routes/index.tsx`, change the import:

```ts
// Before
import HomePage from '../pages/HomePage';

// After
import HomePage from '../pages/home/HomePage';
```

No route path change — still `/`.

---

## Acceptance Criteria

- [ ] Filter pills update the URL and re-fetch the correct status
- [ ] Search input debounces 300 ms and triggers a query; URL reflects the search term
- [ ] Sort select changes the query; URL reflects the sort value
- [ ] Refreshing the page restores filter/search/sort from the URL
- [ ] Scrolling to the bottom of the list automatically loads the next page
- [ ] Skeleton cards appear on first load, `Spinner` appears while loading more
- [ ] Empty states render correctly for the three scenarios above
- [ ] Flagged campaigns show the amber "Under Review" badge via `CampaignStatusBadge`
- [ ] Zero TypeScript errors, zero hardcoded hex
