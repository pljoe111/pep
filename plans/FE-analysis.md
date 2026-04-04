# Frontend Analysis — PepLab

---

## 1. Tech Stack

| Layer        | Technology                                            | Version                                                             |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Build tool   | Vite                                                  | v5                                                                  |
| Framework    | React                                                 | v18                                                                 |
| Language     | TypeScript                                            | v5.3                                                                |
| Styling      | Tailwind CSS                                          | **v4** (Vite plugin variant — no config file, CSS `@theme` instead) |
| Routing      | React Router                                          | v7                                                                  |
| Server state | TanStack Query                                        | v5                                                                  |
| Form state   | react-hook-form                                       | v7                                                                  |
| API client   | Auto-generated OpenAPI client (`packages/api-client`) | workspace                                                           |
| HTTP client  | Axios (shared `axiosInstance` with interceptors)      | v1.6                                                                |
| PWA          | vite-plugin-pwa + Workbox                             | standalone mode, offline fallback                                   |
| QR rendering | qrcode.react                                          | deposit address only                                                |

---

## 2. Brand / Look & Feel

**App name:** PepLab — _"Community-funded science. Verified results."_

**Visual character:** Warm, clean, mobile-native. Teal primary (`#0D9488`) on a warm off-white background (`#F5F4F1`) — purposefully not clinical-hospital-white and not crypto-dark. Feels like a community product built around science, not finance.

**Typography:** System UI stack only — no web fonts loaded. Keeps the bundle small and first render instant. Large font weights (700–800) for titles and money amounts to be readable at arm's length on phones.

| Scale  | Size | Weight | Usage                        |
| ------ | ---- | ------ | ---------------------------- |
| `4xl`  | 36px | 800    | Hero numbers, wallet balance |
| `3xl`  | 30px | 700    | Page headings                |
| `2xl`  | 24px | 700    | Campaign card titles         |
| `xl`   | 20px | 600    | Section headings             |
| `lg`   | 18px | 600    | Card sub-headings            |
| `base` | 16px | 400    | Body text, descriptions      |
| `sm`   | 14px | 400    | Secondary info, timestamps   |
| `xs`   | 12px | 500    | Labels, badges               |

**Border radius:** `rounded-xl` (12px) consistently on cards, inputs, buttons — soft mobile-app feel.

**Tap targets:** All interactive elements enforce `min-h-[44px]` — iOS HIG minimum. Generous spacing throughout.

---

## 3. Layout Architecture

```
AppShell
  ├── TopBar          (fixed top — logo + auth actions)
  ├── <main>          (flex-1, pb-20 to clear BottomNav)
  │     └── PageContainer (max-w, horizontal padding)
  │           └── <page content>
  └── BottomNav       (fixed bottom — Home, Create, My, Wallet)
```

[`AppShell`](packages/fe/src/components/layout/AppShell.tsx) is the single layout wrapper used on every authenticated page. It takes a `hideBottomNav` prop for pages that don't need it (e.g. login). Every page is a full-screen column.

**BottomNav** has 4 items: Home, Create, My Campaigns, Wallet. Uses `NavLink` active state with filled vs outlined inline SVG icon pairs — no icon library dependency.

---

## 4. Routing

[`packages/fe/src/routes/index.tsx`](packages/fe/src/routes/index.tsx) defines two route guard components:

- **`ProtectedRoute`** — redirects to `/login` if no valid token. Shows a full-screen spinner while auth bootstraps.
- **`AdminRoute`** — redirects to `/` if user doesn't have the `admin` claim. Claims checked from JWT-decoded user object in context.

| Route            | Guard       | Page                  |
| ---------------- | ----------- | --------------------- |
| `/`              | Public      | Home — campaign feed  |
| `/campaigns/:id` | Public      | Campaign detail       |
| `/login`         | Public      | Login / register      |
| `/verify-email`  | Public      | Email verification    |
| `/offline`       | Public      | Offline fallback      |
| `/create`        | Protected   | Create campaign       |
| `/my-campaigns`  | Protected   | My campaigns          |
| `/wallet`        | Protected   | Wallet / transactions |
| `/account`       | Protected   | Account settings      |
| `/admin`         | Admin claim | Admin dashboard       |

---

## 5. Auth Architecture

Auth state lives in [`AuthContext`](packages/fe/src/context/AuthContext.tsx) (React Context, not TanStack Query):

- Tokens stored in `localStorage` (`accessToken`, `refreshToken`) — survives page refresh and accessible synchronously by the Axios interceptor.
- **Bootstrap:** On mount, if a token exists, calls `GET /auth/me` to hydrate the user object; clears storage on failure.
- **Axios interceptor** on [`axiosInstance`](packages/fe/src/api/axiosInstance.ts) attaches `Authorization: Bearer` on every request and handles 401 → silent refresh → retry.
- `useAuth()` hook exposes `{ user, isAuthenticated, isLoading, login, logout }`.

---

## 6. Server State (TanStack Query)

All API data goes through TanStack Query v5:

- Each feature area has a dedicated hook file: `useAdmin.ts`, `useCampaigns.ts`, `useWallet.ts`, `useLabs.ts`.
- Query keys are centralized in [`packages/fe/src/api/queryKeys.ts`](packages/fe/src/api/queryKeys.ts).
- API clients are singleton instances in [`packages/fe/src/api/apiClient.ts`](packages/fe/src/api/apiClient.ts) — one per OpenAPI tag group (`AdminApi`, `CampaignsApi`, `WalletApi`, etc.).
- Campaign feed: `staleTime: 300_000` (5 min). Mutations always invalidate related query keys on success.

---

## 7. API Client

The `packages/api-client` package is **auto-generated** from the OpenAPI spec produced by `tsoa` on the BFF. **Never edited manually.** The frontend imports types and API class instances from it — the FE type system exactly mirrors the backend DTOs at all times.

---

## 8. Component Library

Homegrown — no external component library (no shadcn, no MUI, no Chakra). All live in [`packages/fe/src/components/ui/`](packages/fe/src/components/ui/):

| Component                       | Props / behaviour                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `Button`                        | `variant` (primary/secondary/ghost/danger) × `size` (sm/md/lg) × `loading` + `fullWidth` |
| `Card`                          | Surface container with `padding` prop                                                    |
| `Badge`                         | Status pill — `variant` maps to color (amber/blue/purple/indigo/green/red/gray/teal)     |
| `Input` / `Textarea` / `Select` | Form primitives, forward-ref compatible                                                  |
| `Modal`                         | Centered overlay with backdrop dismiss                                                   |
| `Sheet`                         | Bottom-slide drawer for mobile-native flows                                              |
| `Spinner`                       | Loading indicator, `size` prop                                                           |
| `EmptyState`                    | Empty list placeholder with optional CTA                                                 |
| `ProgressBar`                   | Campaign funding progress                                                                |
| `Tabs`                          | Simple tab switcher — Admin + Wallet pages                                               |
| `Toast`                         | Notifications via context (`useToast()`)                                                 |
| `Avatar`                        | User avatar with initials fallback                                                       |

---

## 9. Architectural Principles

1. **No third-party component library** — full control over styling; no fighting overrides. All UI is Tailwind utility classes directly.
2. **OpenAPI-first type safety** — FE never defines its own types for API shapes. Everything comes from `api-client`.
3. **Context for auth, TanStack Query for everything else** — auth state is global and synchronous; data is async and cached.
4. **Mobile-first, PWA-native** — targets 375px screens, standalone mode. Tap targets enforced. Safe-area insets respected (`env(safe-area-inset-bottom)`).
5. **Infinite scroll for browsing, pagination for admin/management** — Home feed uses cursor-based infinite scroll; wallet and admin tables use page numbers.
6. **Sheets over modals on mobile** — contribute, deposit QR, and review flows slide up from the bottom on small screens.
7. **Inline SVG icons only** — no icon library. Icons are inlined as JSX with active/inactive filled/outlined variants.
8. **All env config through a single `config.ts`** — `VITE_API_URL` etc. never accessed as `import.meta.env.X` directly in components.

---

## 10. Color System

### Tier 1 — Semantic CSS Custom Properties

Defined in [`packages/fe/src/index.css`](packages/fe/src/index.css) via Tailwind v4's `@theme {}` block. These automatically become Tailwind utilities (`bg-primary`, `text-text-2`, etc.).

| Token               | Hex       | Tailwind class               | Usage                                                   |
| ------------------- | --------- | ---------------------------- | ------------------------------------------------------- |
| `--color-primary`   | `#0D9488` | `bg-primary`, `text-primary` | Buttons, links, active nav, progress fills, focus rings |
| `--color-primary-d` | `#0F766E` | `bg-primary-d`               | Button hover/active states                              |
| `--color-primary-l` | `#CCFBF1` | `bg-primary-l`               | Ghost button hover, teal tint backgrounds               |
| `--color-bg`        | `#F5F4F1` | `bg-bg`                      | Page background — warm off-white, body default          |
| `--color-surface`   | `#FFFFFF` | `bg-surface`                 | Cards, modals, inputs — white lifts off bg              |
| `--color-surface-a` | `#FAFAF9` | `bg-surface-a`               | Code blocks, secondary areas, secondary button hover    |
| `--color-border`    | `#E7E5E4` | `border-border`              | All dividers, input borders, card borders               |
| `--color-text`      | `#1C1917` | `text-text`                  | Body text — warm near-black (not pure #000)             |
| `--color-text-2`    | `#78716C` | `text-text-2`                | Secondary: timestamps, creator names, descriptions      |
| `--color-text-3`    | `#A8A29E` | `text-text-3`                | Tertiary: placeholder hints, "updated at" stamps        |
| `--color-success`   | `#059669` | `text-success`, `bg-success` | Success toasts, resolved state accents                  |
| `--color-warning`   | `#D97706` | `text-warning`               | Warning toasts                                          |
| `--color-danger`    | `#DC2626` | `bg-danger`, `text-danger`   | Danger button bg, error messages, form validation       |
| `--color-info`      | `#2563EB` | `text-info`                  | Info toasts                                             |

The warm-gray stone family (`#1C1917` → `#78716C` → `#A8A29E`) gives all text a consistent warm undertone. Nothing in the palette uses a cold/blue-gray.

### Tier 2 — Tailwind Palette Direct (Badge only)

[`Badge.tsx`](packages/fe/src/components/ui/Badge.tsx) uses Tailwind's built-in palette directly for status colors — distinct semantic meaning not covered by the semantic token set. All use the `*-100` background / `*-800` text pairing for legibility at `xs` size on both white cards and the warm-gray page background.

| Variant  | Background                 | Text                         | Used for                                                    |
| -------- | -------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `amber`  | `bg-amber-100` `#FEF3C7`   | `text-amber-800` `#92400E`   | Campaign `created` (Open), COA `code_not_found`             |
| `blue`   | `bg-blue-100` `#DBEAFE`    | `text-blue-800` `#1E40AF`    | Campaign `funded`                                           |
| `purple` | `bg-purple-100` `#EDE9FE`  | `text-purple-800` `#3730A3`  | Campaign `samples_sent`                                     |
| `indigo` | `bg-indigo-100` `#E0E7FF`  | `text-indigo-800` `#3730A3`  | Campaign `results_published`                                |
| `green`  | `bg-emerald-100` `#D1FAE5` | `text-emerald-800` `#065F46` | Campaign `resolved`, COA `code_found` / `manually_approved` |
| `red`    | `bg-red-100` `#FEE2E2`     | `text-red-800` `#991B1B`     | Campaign `refunded`, COA `rejected`                         |
| `gray`   | `bg-stone-100` `#F5F5F4`   | `text-stone-600` `#57534E`   | COA `pending`, default/unknown                              |
| `teal`   | `bg-teal-100` `#CCFBF1`    | `text-teal-800` `#115E59`    | Available, used sparingly                                   |

### Button Colors

[`Button.tsx`](packages/fe/src/components/ui/Button.tsx) uses only semantic tokens:

| Variant     | Resting                        | Hover/Active             | Text           |
| ----------- | ------------------------------ | ------------------------ | -------------- |
| `primary`   | `bg-primary` `#0D9488`         | `bg-primary-d` `#0F766E` | White          |
| `secondary` | `bg-surface` + `border-border` | `bg-surface-a`           | `text-text`    |
| `ghost`     | Transparent                    | `bg-primary-l` `#CCFBF1` | `text-primary` |
| `danger`    | `bg-danger` `#DC2626`          | `bg-red-700` `#B91C1C`   | White          |

`sm` buttons (height 36px) are used only in dense admin table rows where multiple actions sit side-by-side. All other interactive elements meet the 44px minimum.

### Funding Progress Bar

Uses `#2DD4BF` (Tailwind `teal-400`) — slightly lighter/brighter than primary `#0D9488`. The contrast makes the progress fill read as active and alive against white card surfaces.

### Toast Colors

4 variants using semantic tokens as text on a white surface card:

| Type    | Color          | Hex       |
| ------- | -------------- | --------- |
| Success | `text-success` | `#059669` |
| Warning | `text-warning` | `#D97706` |
| Error   | `text-danger`  | `#DC2626` |
| Info    | `text-info`    | `#2563EB` |

### Color Philosophy

One deliberate constraint: **the semantic tier (`--color-*`) is used for UI chrome and interaction states; the palette tier (Tailwind `amber-`, `emerald-`, etc.) is used only for status communication.** This keeps the teal primary unmistakably "brand" and makes status badges visually distinct from surrounding UI.

---

## 11. PWA Configuration

- **App name:** PepLab / short name: PepLab
- **Display:** standalone (no browser chrome)
- **Orientation:** portrait
- **Theme color:** `#0D9488`
- **Background color:** `#F5F4F1`
- **Offline fallback:** `/offline` route shown for data routes when network unavailable
- **Service worker:** Workbox `NetworkFirst` strategy — all API responses cached up to 200 entries / 24h
- **Campaign feed stale time:** 5 minutes (TanStack Query `staleTime: 300_000`)
