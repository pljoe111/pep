# S02 — Notification Hooks + TopBar Bell

**Depends on:** nothing (foundation story — can run in parallel with S01)  
**Unlocks:** S12

---

## Purpose

Add a working notification center to the app. This includes:

1. TanStack Query hooks for notifications (list + unread count + mark read)
2. A `NotificationCenter` sheet component
3. A bell icon with unread badge in `TopBar`

Currently there is no notification UI in the app — the hooks are missing from `src/api/hooks/` and the TopBar has no bell.

---

## Files to Create

```
src/api/hooks/
└── useNotifications.ts         ← NEW

src/components/notifications/
├── NotificationCenter.tsx       ← NEW
└── NotificationItem.tsx         ← NEW
```

## Files to Rewrite

```
src/components/layout/TopBar.tsx   ← DELETE old, write from scratch (see section 4)
```

---

## Reference: API Client

The generated `api-client` package exposes a `NotificationsApi` class. Relevant methods (check actual generated types but these match the BFF spec):

- `notificationsControllerGetNotifications({ page })` → paginated list of `NotificationDto`
- `notificationsControllerGetUnreadCount()` → `{ count: number }`
- `notificationsControllerMarkRead({ id })` → marks one read
- `notificationsControllerMarkAllRead()` → marks all read

`NotificationDto` shape (from `packages/common/src/dtos/notification.dto.ts`):

```ts
{
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: { campaignId?: string; [key: string]: unknown };
}
```

The `NotificationsApi` singleton lives in `src/api/apiClient.ts`. Import it from there — do **not** instantiate a new one.

---

## 1. `src/api/hooks/useNotifications.ts`

Create all notification-related TanStack Query hooks here.

```ts
// Hooks to export:

// Paginated list (page = 1-based)
export function useNotifications(page: number);

// Unread count — polled every 30 seconds
export function useUnreadNotificationCount();

// Mutation: mark one read
export function useMarkNotificationRead();

// Mutation: mark all read
export function useMarkAllNotificationsRead();
```

**Implementation notes:**

- Query keys come from `src/api/queryKeys.ts`:
  - `queryKeys.notifications.list(page)` for the list
  - `queryKeys.notifications.unreadCount` for the count
- `useUnreadNotificationCount` must set `refetchInterval: 30_000` to poll every 30 s
- Both mutations must invalidate **both** `queryKeys.notifications.list(1)` (reset to page 1) and `queryKeys.notifications.unreadCount` on success
- `useMarkNotificationRead` takes `{ id: string }` as mutation variables
- All return types must be explicit (no implicit `any`)

---

## 2. `src/components/notifications/NotificationItem.tsx`

A single row in the notification list.

```tsx
interface NotificationItemProps {
  notification: NotificationDto; // from api-client
  onRead: (id: string) => void; // called on tap
}
```

**Layout:**

```
┌──────────────────────────────────────────────┐
│ [●] Title text                    2 min ago  │
│     Body excerpt (2 lines max, truncated)    │
└──────────────────────────────────────────────┘
```

- Unread indicator: filled `bg-primary` circle `w-2 h-2 rounded-full` on the left; hidden when `isRead`
- Title: `text-sm font-medium text-text`
- Body: `text-sm text-text-2 line-clamp-2`
- Timestamp: `text-xs text-text-3` — use `formatRelativeDate` from `src/lib/formatters`
- Full row is `min-h-[44px]` with `py-3 px-4`
- Tap calls `onRead(notification.id)` then navigates to the related campaign if `metadata.campaignId` is present (use `useNavigate`)
- Unread rows: `bg-surface` (white); read rows: `bg-bg` (warm off-white) to visually distinguish

---

## 3. `src/components/notifications/NotificationCenter.tsx`

A bottom `Sheet` containing the paginated notification list.

```tsx
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout (inside Sheet):**

```
┌─────────────────────────────────────┐
│  Notifications        [Mark all ✓]  │  ← header row
├─────────────────────────────────────┤
│  NotificationItem                   │
│  NotificationItem                   │
│  ...                                │
├─────────────────────────────────────┤
│  [Load more]  (if hasNextPage)      │
└─────────────────────────────────────┘
```

- Use `useNotifications(page)` with local `page` state starting at 1
- "Mark all as read" button: ghost `Button` variant, calls `useMarkAllNotificationsRead` mutation
- "Load more" button at bottom (secondary variant) — increments page, appends results
- While loading first page: show 3 `Spinner` placeholder rows (or a skeleton using `animate-pulse bg-border rounded h-12`)
- Empty state: `EmptyState` component from `src/components/ui/EmptyState` with message "No notifications yet"
- `onRead` callback: calls `useMarkNotificationRead` with the notification id, then navigates if `metadata.campaignId` is present, then calls `onClose()`
- Sheet title: "Notifications"

---

## 4. `src/components/layout/TopBar.tsx` (write from scratch)

The old TopBar is replaced entirely. Write a fresh `TopBar` component that includes the notification bell. Do not try to read or preserve the old file.

**The TopBar must include:**

- PepLab logo/name on the left (link to `/`)
- Bell button on the right (authenticated users only) — see below
- Any auth action buttons (login link for unauthenticated, logout elsewhere)
- `NotificationCenter` sheet mounted inside TopBar

**Bell button:**

```tsx
// Only shown when authenticated
{
  isAuthenticated && (
    <button
      onClick={() => setIsNotifOpen(true)}
      className="relative flex items-center justify-center w-10 h-10 rounded-xl text-text-2 hover:bg-surface-a"
      aria-label="Notifications"
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
```

- `unreadCount` comes from `useUnreadNotificationCount().data?.count ?? 0`
- `NotificationCenter` sheet rendered at end of TopBar JSX, passing `isOpen={isNotifOpen}` and `onClose={() => setIsNotifOpen(false)}`

---

## Acceptance Criteria

- [ ] `useNotifications` and `useUnreadNotificationCount` compile and return correctly typed data
- [ ] Bell icon appears in TopBar only when authenticated
- [ ] Unread count badge appears when count > 0, shows `9+` when > 9
- [ ] Tapping the bell opens the NotificationCenter sheet
- [ ] "Mark all as read" clears the unread badge
- [ ] Tapping a notification with `metadata.campaignId` navigates to `/campaigns/:id` and closes the sheet
- [ ] NotificationCenter shows empty state when there are no notifications
- [ ] No TypeScript errors, no hardcoded hex
