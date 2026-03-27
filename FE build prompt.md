You are building the frontend for the Peptide Crowdfunding Platform. The backend is complete and documented in `packages/bff/specs/API-REFERENCE.md`. The auto-generated API client is already available at `packages/api-client` — use it for every API call, never write raw `fetch` calls.

Read `packages/bff/specs/API-REFERENCE.md` in full before writing any code. Read `packages/fe/src/api/axiosInstance.ts` and `packages/fe/src/routes/index.tsx` to understand what already exists. Read `packages/api-client/src/generated/index.ts` to understand what client methods are available.

---

## What You Are Building

A mobile-first Progressive Web App for a community that pools money to fund independent lab testing of peptides and supplements. The primary user is a **contributor** — someone browsing campaigns, reading results, and chipping in money. Design every screen with that person in mind first.

---

## Brand and Visual Direction

Pick a name, color palette, and visual identity that fits these constraints — document your choices at the top of `packages/fe/src/design-system.md` before writing any component:

- **Tone:** Community-driven, warm, high-activity. Think Reddit meets a science forum — lots of visible social proof (reaction counts, contributor counts, funding progress), feels alive and participatory, not corporate or sterile.
- **Not:** Dark crypto aesthetic. Not clinical white. Not a bank app.
- **Typography:** Strong readable hierarchy. Large campaign titles. Clear money amounts. Everything legible at arm's length on a phone.
- **Color:** Pick a warm primary (amber, teal, or similar — your call), a neutral background that isn't pure white, and a clear success/warning/danger system. Document hex values.
- **Spacing:** Generous. Mobile cards should breathe. Nothing cramped.

Write `design-system.md` first. It must contain: chosen name, color palette with hex values, typography scale, spacing scale, and the reasoning for each choice. This is your reference for the rest of the session.

---

## Tech Stack

The boilerplate is already scaffolded in `packages/fe`. Work within it.

| Concern          | Decision                                                    |
| ---------------- | ----------------------------------------------------------- |
| Framework        | React 18 + Vite (already configured)                        |
| Routing          | `react-router-dom` v7 (already installed)                   |
| Styling          | Tailwind CSS — install and configure if not already present |
| Server state     | TanStack Query (React Query v5) — install if not present    |
| Local/auth state | React Context + `useState` — no Zustand, no Redux           |
| Forms            | React Hook Form — install if not present                    |
| QR codes         | `qrcode.react` — install if not present                     |
| API calls        | `packages/api-client` only — never raw fetch                |
| Token storage    | `localStorage` — access token + refresh token               |
| PWA              | Vite PWA plugin — install and configure                     |

**Permitted installs:** Tailwind CSS + its Vite plugin, TanStack Query, React Hook Form, `qrcode.react`, Vite PWA plugin, and their type packages. No other new packages. No CSS-in-JS. No UI component libraries (no shadcn, no MUI, no Radix — raw Tailwind only).

Document every package you install and why in `design-system.md`.

---

## Architecture Rules

### File structure

```
packages/fe/src/
  api/
    axiosInstance.ts        ← already exists, configure auth header here
    queryClient.ts          ← TanStack Query client config
    hooks/                  ← one file per domain: useAuth.ts, useCampaigns.ts, useWallet.ts, etc.
  components/
    ui/                     ← pure reusable primitives: Button, Card, Badge, Input, Modal, etc.
    layout/                 ← AppShell, BottomNav, TopBar, PageContainer
    campaigns/              ← CampaignCard, CampaignProgress, ReactionBar, etc.
    wallet/                 ← BalanceDisplay, DepositQR, TransactionRow, etc.
    admin/                  ← AdminCampaignRow, CoaVerifyModal, etc.
  pages/                    ← one file per route
  context/
    AuthContext.tsx          ← user, tokens, login, logout, refresh
  hooks/                    ← shared non-API hooks: useDebounce, usePagination, etc.
  lib/
    formatters.ts            ← currency, date, percent formatters
    validators.ts            ← Solana address validation, etc.
  design-system.md
```

### Auth flow

- On app load: read `accessToken` and `refreshToken` from `localStorage`
- Attach `Authorization: Bearer <accessToken>` to every API request via the axios instance interceptor
- On 401 response: attempt token refresh via `POST /auth/refresh`, retry the original request once, then redirect to login if refresh fails
- `AuthContext` exposes: `user`, `isAuthenticated`, `isLoading`, `login()`, `logout()`, `refreshTokens()`
- Protected routes redirect to `/login` if not authenticated
- Admin routes additionally check `user.claims.includes('admin')`, redirect to `/` if not

### State management rules

Document the following in a comment at the top of every file that manages state:

- What state lives here
- Why it lives here and not somewhere else
- What triggers a refetch or update

### Query keys

Define all TanStack Query keys in `src/api/queryKeys.ts` as a typed constant object. Never inline string keys.

```typescript
// src/api/queryKeys.ts
export const queryKeys = {
  campaigns: {
    all: ['campaigns'] as const,
    list: (filters: CampaignFilters) => ['campaigns', 'list', filters] as const,
    detail: (id: string) => ['campaigns', id] as const,
    contributions: (id: string) => ['campaigns', id, 'contributions'] as const,
    reactions: (id: string) => ['campaigns', id, 'reactions'] as const,
  },
  wallet: {
    balance: ['wallet', 'balance'] as const,
    transactions: (filters: TxFilters) => ['wallet', 'transactions', filters] as const,
    depositAddress: ['wallet', 'deposit-address'] as const,
  },
  // ... etc
} as const;
```

---

## PWA Configuration

Configure `vite-plugin-pwa` with:

- App name = your chosen brand name
- Short name = abbreviated version
- Theme color = your chosen primary color
- Background color = your chosen background color
- Display mode: `standalone`
- Icons: generate from a simple SVG — the agent picks an appropriate icon that fits the brand
- Offline fallback: show a simple "You're offline — check your connection" page for routes that require data

---

## Pages to Build

Build these pages in this order. Complete each one — including loading states, empty states, and error states — before moving to the next.

### 1. `/` — Campaign Feed (Home)

The most important page. Optimized for contributors discovering campaigns.

- Grid of `CampaignCard` components (2-column on mobile, 3 on tablet+)
- Each card shows: title, creator username, funding progress bar (visual + percent), status badge, sample labels, reaction counts, time remaining
- Filter bar: status filter (`active`, `funded`, `resolved`, `refunded`), sort (`newest`, `progress_desc`, `deadline_asc`)
- Search input with debounce (300ms)
- Infinite scroll OR pagination — agent decides which fits better on mobile, document the choice
- Pull-to-refresh on mobile (use the `refetchOnWindowFocus` + manual refetch pattern)
- Campaigns with `is_flagged_for_review = true` show a subtle warning indicator
- Empty state: friendly illustration + "No campaigns found — be the first to create one"

### 2. `/campaigns/:id` — Campaign Detail

- Hero section: title, status badge, creator info, verified campaign count
- Funding progress: large visual bar, current / threshold / requested amounts, contributor count, time remaining
- Reaction bar: tap to react, counts update optimistically
- Tab bar (mobile-friendly, swipeable): **Overview** | **Samples & Tests** | **Results** | **Updates**
  - **Overview:** description, lab info, itemization if present
  - **Samples & Tests:** each sample card with claims, target lab, tests requested
  - **Results:** COA cards per sample — verification status badge, link to view PDF, uploaded date
  - **Updates:** paginated list of creator text updates and state-change events
- Sticky bottom CTA: "Contribute" button — visible when status is `created` or `funded`, hidden otherwise
- Contribute sheet: slides up from bottom (mobile sheet pattern), amount input, currency selector (USDC/USDT), balance shown, confirm button
- Contribution requires email verified — show inline prompt if not

### 3. `/create` — Campaign Creation Wizard

Multi-step wizard, one section per screen. Progress indicator at the top showing current step.

**Step 1 — Basics**

- Title, description (markdown-aware textarea with preview toggle), amount requested
- Funding threshold percent slider (5–100)
- Live cost estimate updates as user fills in samples in step 2 — show "Complete step 2 to see estimate"

**Step 2 — Samples**

- Add sample form: vendor name, purchase date, physical description, sample label
- Lab picker: searchable dropdown from `GET /labs?approved_only=true`
- Test picker: multi-select from the lab's available tests (populated after lab selection)
- Claims: add mass claim (amount + unit from valid_mass_units) or free-text claim
- Add multiple samples — each appears as a card; tap to edit or remove
- Running estimated cost updates live as tests are added/removed

**Step 3 — Review**

- Verification code display — large, prominent, copyable
- Full summary of campaign details, samples, tests, estimated cost
- Validation: `amount_requested <= 1.5 × estimated_cost` enforced with clear error message
- Submit button → calls `POST /campaigns` → on success navigate to `/campaigns/:id`

**Step persistence:** Save wizard state to `localStorage` so the user doesn't lose progress if they leave and return. Clear on successful submission.

### 4. `/wallet` — Wallet Dashboard

- Balance cards: USDC balance, USDT balance — large and readable
- **Deposit section:**
  - User's deposit address displayed as copyable text
  - QR code generated from `qr_hint` using `qrcode.react`
  - "Send USDC or USDT to this address on Solana" — clear plain-language instruction
  - No wallet connect, no web3 library — just the address and QR
- **Withdraw section:**
  - Amount input, currency selector
  - Destination address input with Solana address validation
  - Shows minimum withdrawal amount from app-info
  - Submits to `POST /wallet/withdraw` → shows pending state
- **Transaction history:**
  - Paginated list of transactions
  - Each row: type badge (deposit/withdrawal/contribution/refund/payout/fee), amount + currency, status badge, date
  - Filter by type
  - Pending transactions shown with a spinner/pulse animation

### 5. `/admin` — Admin Dashboard

Only accessible to users with the `admin` claim. Redirect non-admins to `/`.

**Campaigns tab:**

- Table/list of all campaigns with status, flagged indicator, creator, funding amount
- Filter by status + flagged
- For each campaign: quick actions — Force Refund, Hide/Unhide
- Click to expand and see COAs pending verification

**COA Verification panel:**

- List of campaigns with COAs in `pending` or `code_not_found` status
- Each COA row: sample label, campaign title, uploaded date, verification status badge, link to view PDF
- Approve / Reject buttons — reject requires a notes input
- Approve calls `POST /admin/coas/:id/verify` with `status: 'approved'`
- Reject opens a modal with a notes textarea, then calls with `status: 'rejected'`

**Users tab:**

- Search by email or username
- Ban / Unban toggle
- Grant / Revoke claims

**Config tab:**

- Display all config keys and current values
- Inline edit for simple values
- Save calls `PUT /admin/config/:key`

**Fee Sweep tab:**

- USDC and USDT fee balances shown
- Destination address input
- Sweep button per currency

---

## Components to Build

### UI Primitives (`src/components/ui/`)

Build these before any pages. Every page uses them.

```
Button          — variants: primary, secondary, ghost, danger; sizes: sm, md, lg; loading state
Input           — label, error message, helper text
Textarea        — same as Input
Select          — styled native select with arrow
Badge           — variants: status colors mapped to CampaignStatus and VerificationStatus
Card            — wrapper with consistent shadow/border/radius
Modal           — accessible, focus-trapped, backdrop click to close
Sheet           — slides up from bottom (mobile drawer pattern)
ProgressBar     — animated fill, accepts percent 0–100
Spinner         — loading indicator
Avatar          — initials fallback if no image
Tabs            — mobile-swipeable tab bar
Toast           — success/error/info notifications, auto-dismiss after 4s
EmptyState      — icon + heading + subtext + optional CTA
```

Map `CampaignStatus` to Badge colors consistently:

- `created` → amber
- `funded` → blue
- `samples_sent` → purple
- `results_published` → indigo
- `resolved` → green
- `refunded` → red

Map `VerificationStatus` to Badge colors:

- `pending` → gray
- `code_found` → green
- `code_not_found` → amber
- `manually_approved` → green
- `rejected` → red

### Layout (`src/components/layout/`)

```
AppShell        — wraps all authenticated pages; renders TopBar + BottomNav + children
TopBar          — app name/logo left, notification bell + avatar right (links to /wallet and /profile)
BottomNav       — 4 tabs: Home (feed), Create, Wallet, Account — active state, icons + labels
PageContainer   — max-width wrapper with horizontal padding
```

### Formatters (`src/lib/formatters.ts`)

```typescript
formatUSD(amount: number): string           // "$1,234.56"
formatCrypto(amount: number, currency: 'usdc' | 'usdt'): string  // "1,234.56 USDC"
formatPercent(value: number): string        // "73.4%"
formatTimeRemaining(seconds: number): string // "6d 4h" or "Expired"
formatDate(iso: string): string             // "Jun 12, 2025"
formatRelativeDate(iso: string): string     // "2 hours ago"
truncateAddress(address: string): string    // "So1a…b58x"
```

---

## Loading, Empty, and Error States

Every data-fetching component must handle all three states. No exceptions.

**Loading:** Use skeleton screens (pulsing gray blocks matching the shape of the content), not spinners in the middle of a page. Spinners are only for button loading states and small inline actions.

**Empty:** Friendly, not blank. Each empty state has a relevant short message and where appropriate a CTA (e.g. "No campaigns yet — create the first one").

**Error:** Show a card with a short message and a Retry button that calls the query's `refetch()`. Do not show raw error objects or stack traces.

---

## Mobile-First Rules

- All layouts start at 375px width. Add `md:` and `lg:` breakpoints for larger screens — never the other way around.
- Tap targets minimum 44×44px.
- Bottom navigation — never a sidebar on mobile.
- Modals become full-screen bottom sheets on mobile.
- All forms use appropriate mobile keyboard types: `inputMode="decimal"` for amounts, `inputMode="none"` for the Solana address field (to prevent autocorrect mangling it).
- No hover-only interactions. Every interactive element must work with tap.

---

## PWA Requirements

- App must be installable (manifest.json configured correctly)
- Splash screen uses brand colors
- Status bar color matches brand
- Offline page at `/offline` — shown when user navigates to a data route while offline
- The campaign feed page caches the last successful response via TanStack Query's `staleTime` (set to 5 minutes) so users see something while offline

---

## Build Order

Complete each step, run the build, fix all errors, then proceed.

1. Install required packages, configure Tailwind, configure PWA plugin
2. Write `design-system.md`
3. Build all UI primitives in `src/components/ui/`
4. Build layout components
5. Write `formatters.ts` and `validators.ts`
6. Configure `AuthContext` and auth interceptor on the axios instance
7. Write all query hooks in `src/api/hooks/`
8. Build pages in order: Home → Campaign Detail → Create Wizard → Wallet → Admin
9. Configure routing in `src/routes/index.tsx`
10. Configure PWA manifest and service worker
11. Final check: `pnpm --filter fe build` must exit clean

After completing each page run:

```bash
pnpm --filter fe build 2>&1 | tail -20
```

Fix all TypeScript and Tailwind errors before moving to the next page. Do not accumulate errors.

---

## What Not To Do

- Do not write raw `fetch()` or `axios` calls outside of `axiosInstance.ts` — use the api-client
- Do not use any CSS-in-JS
- Do not use Redux, Zustand, Jotai, or any external state store
- Do not install UI component libraries
- Do not add `// @ts-ignore` or `// eslint-disable`
- Do not create wallet-connect flows, browser extension integrations, or Web3 providers — the deposit address + QR is the entire crypto UX
- Do not build a notifications page (not in scope) — the bell icon can show unread count only
- Do not build a leaderboard page (not in scope) — it can be a future addition
- Do not build user profile pages (not in scope for this build)

---

## TypeScript and ESLint Rules — Non-Negotiable

The build pipeline runs `tsc && vite build` followed by `eslint . --ext ts,tsx --max-warnings 0`. Both must exit clean. A single ESLint warning is a hard failure. A single type error prevents the bundle from producing.

Read these rules before writing any component. They are enforced automatically — you cannot ship around them.

### Absolute prohibitions (same as the BFF)

```
// @ts-ignore              ← FORBIDDEN
// @ts-expect-error        ← FORBIDDEN
// eslint-disable          ← FORBIDDEN (any form, any line, any block)
// eslint-disable-next-line ← FORBIDDEN
```

If TypeScript or ESLint is complaining, fix the underlying problem. Never suppress.

### `any` is forbidden

`no-explicit-any` is configured as `error`. The only permitted use of `any` is inside a `catch` block parameter — and even then you must narrow it before use:

```typescript
// FORBIDDEN
} catch (e: any) {
  console.error(e.message);
}

// REQUIRED
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  toast.error(message);
}
```

### Unsafe rules from `recommended-requiring-type-checking`

These fire when a value typed as `any` or `unknown` escapes its boundary. The most common sources in frontend code and their fixes:

**`no-unsafe-assignment` / `no-unsafe-member-access`** — usually from API response data or `JSON.parse`. Fix by typing the response through the api-client (which already types everything) or by writing a typed parser:

```typescript
// WRONG — api-client already returns typed data; do not re-cast
const data = response.data as any;

// RIGHT — use the type the api-client provides directly
const data: CampaignDetailDto = response.data;
```

**`no-unsafe-argument`** — passing an unnarrowed value to a typed function. Narrow first.

**`no-floating-promises`** — an async call whose promise is not awaited and not explicitly discarded. In React event handlers and `useEffect` cleanups this fires often. Fix:

```typescript
// WRONG — floating promise in event handler
const handleClick = () => {
  submitContribution(amount);
};

// RIGHT — make the handler async, or explicitly void it
const handleClick = () => {
  void submitContribution(amount);
};

// ALSO RIGHT — if you need error handling
const handleClick = async () => {
  try {
    await submitContribution(amount);
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Something went wrong');
  }
};
```

**`no-unsafe-return`** — returning an `any`-typed value from a function with a concrete return type. Fix the return type or the source of `any`.

### Strict null checks

`strict: true` includes `strictNullChecks`. Do not use the non-null assertion operator (`!`) unless you can write a truthful comment proving the value cannot be null at that point:

```typescript
// FORBIDDEN
const id = user!.id;

// REQUIRED form — only when proven non-null
// SAFETY: user is defined here because this component is inside AuthGuard
//         which redirects to /login if user is null.
const id = user!.id;

// PREFERRED — just narrow it
if (!user) return null;
const id = user.id;
```

### Unused locals and parameters

`noUnusedLocals` and `noUnusedParameters` are enabled. Any declared variable or parameter that is never used is a type error. The only exception is destructured parameters prefixed with `_`:

```typescript
// WRONG — unused param causes type error
const MyComponent = ({ id, onClick }: Props) => {
  return <div>{id}</div>; // onClick never used
};

// RIGHT — prefix with _ to signal intentionally unused
const MyComponent = ({ id, _onClick }: Props) => {
  return <div>{id}</div>;
};
```

### React-specific rules

**`rules-of-hooks`** — hooks must be called at the top level of a component or custom hook. Never inside conditionals, loops, or callbacks.

**`exhaustive-deps`** — every value referenced inside a `useEffect`, `useCallback`, or `useMemo` must be in the dependency array, or you must have a documented reason why not. Do not suppress this rule — restructure the code instead.

```typescript
// WRONG — missing dep, lint error
useEffect(() => {
  fetchCampaign(campaignId);
}, []); // campaignId not in deps

// RIGHT
useEffect(() => {
  void fetchCampaign(campaignId);
}, [campaignId, fetchCampaign]);
```

### Prettier is enforced as a lint error

`plugin:prettier/recommended` means any formatting that differs from Prettier's output is an ESLint error. Do not manually format — let the formatter handle it. Run `pnpm --filter fe lint --fix` to auto-fix formatting before checking for real errors.

### React component return types

Every component must have an explicit return type annotation:

```typescript
// WRONG
const CampaignCard = ({ campaign }: Props) => {
  return <div>...</div>;
};

// RIGHT
const CampaignCard = ({ campaign }: Props): React.ReactElement => {
  return <div>...</div>;
};

// For components that can return null
const ConditionalBanner = ({ show }: Props): React.ReactElement | null => {
  if (!show) return null;
  return <div>...</div>;
};
```

### Props interfaces — no inline object types

```typescript
// WRONG
const Button = ({ label, onClick }: { label: string; onClick: () => void }) => ...

// RIGHT
interface ButtonProps {
  label: string;
  onClick: () => void;
}
const Button = ({ label, onClick }: ButtonProps): React.ReactElement => ...
```

### No `console.*` anywhere in `src/`

Use the toast system for user-facing messages. For debugging, remove the log before committing — the linter will catch unused expressions in most cases, and Prettier will flag formatting, but `console.log` itself is not an ESLint error in this config. Still forbidden by convention — search for and remove all `console.*` before reporting done.

### Check cadence

After completing each file or component, run:

```bash
pnpm --filter fe build 2>&1 | grep -E "error|warning"
```

The error and warning count must be zero before moving to the next file. Do not accumulate a backlog of type errors across multiple components — they compound and become hard to untangle.

After completing all pages, run the full pipeline:

```bash
pnpm build 2>&1 | tail -30
```

This runs `build:common → build:api-client → build:bff → build:fe → lint` in order. Everything must pass. This is the final gate — do not report done until this exits with code 0.

## Done Criteria

Report back with:

- The brand name and color palette you chose and why
- Every package installed
- Every page built with a one-line description of its current state
- Output of `pnpm --filter fe build` — must be clean
- Any spec gaps you encountered and how you resolved them
