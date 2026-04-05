# Admin Panel Rebuild — AI Agent Execution Prompt

> **For the executing agent:** Read this entire document before writing a single line of code. Every constraint is a hard rule — not a suggestion. When in doubt, do less and do it correctly rather than more and do it wrong.

---

## Your Mission

Rebuild the PepLab admin panel frontend from scratch according to the spec below. The old [`AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx) (2898 lines, everything in one file) has already been deleted. You are replacing it with a properly structured component tree.

**You are working only in `packages/fe/src/`**. Do not touch backend files.

---

## Non-Negotiable Hard Constraints

These apply to **every single file** you create. Violations will cause rejection of the entire output.

### Code Quality

1. **No `@ts-ignore`, `@ts-expect-error`, or `eslint-disable`** — ever, in any form.
2. **No `any`** — use `unknown` with type guards, generics, or concrete types. Exception: `catch (e: unknown)` is fine.
3. **No `console.log`** anywhere in `src/`.
4. **No `confirm()` or `prompt()` browser dialogs** — every destructive action requires `AdminConfirmModal`.
5. **No hardcoded hex values** — use semantic tokens (`text-primary`, `text-danger`, `bg-surface`, etc.) or Tailwind palette classes only.
6. **No importing from `api-client` except types** — never define your own API response shapes.
7. **No `import.meta.env.X`** in components — use `config.ts` if env is needed (it won't be for this task).
8. **No external component libraries** — no shadcn, MUI, Chakra, etc.
9. **All explicit return types on all functions** — every component function, every handler, every helper.
10. **No icon libraries** — all icons are inline `<svg>` JSX.

### File Size

11. **No file may exceed ~200 lines.** If you find yourself going over, stop and extract a subcomponent.

### Architecture

12. **No data fetching inside tab files** — tabs import hooks and pass props down. No `useQuery` calls directly in tab files.
13. **No modal logic inside tab files** — modals are imported from their own files.
14. **No business logic in components** — components render and call callbacks; hooks hold all mutation/query logic.
15. **All components must use explicit `React.ReactElement` return type** (not `JSX.Element`, not `ReactNode`).

### Styling

16. **Mobile-first, target 375px** — never break layout at narrow widths.
17. **All interactive elements `min-h-[44px]`** — no exceptions. Small action buttons in dense rows may use `min-h-[36px]` only inside `LabTestRow`, `TestCatalogRow`, and `ConfigRow`.
18. **`rounded-xl` on all cards, inputs, buttons, selects**.
19. **All grays are warm stone family** — never use cold gray (`gray-`, `slate-`, `zinc-`, `neutral-`). Use `stone-`.
20. **Badge colors only from the existing [`Badge`](packages/fe/src/components/ui/Badge.tsx) variant set**: `amber | blue | purple | indigo | green | red | gray | teal`.

---

## What Already Exists — Do Not Recreate

These files exist and are correct. **Import from them; do not copy their contents.**

### UI Primitives (all in `packages/fe/src/components/ui/`)

- [`Button.tsx`](packages/fe/src/components/ui/Button.tsx) — variants: `primary | secondary | ghost | danger`; sizes: `sm | md | lg`; props: `loading`, `fullWidth`, `disabled`
- [`Badge.tsx`](packages/fe/src/components/ui/Badge.tsx) — variants: `amber | blue | purple | indigo | green | red | gray | teal`
- [`Modal.tsx`](packages/fe/src/components/ui/Modal.tsx) — props: `isOpen`, `onClose`, `title`, `children`, `size?: 'sm' | 'md' | 'lg'`
- [`Card.tsx`](packages/fe/src/components/ui/Card.tsx) — prop: `padding?: 'sm' | 'md' | 'lg'`
- [`Tabs.tsx`](packages/fe/src/components/ui/Tabs.tsx) — props: `tabs: {id, label, content}[]`, `defaultTab`
- [`Spinner.tsx`](packages/fe/src/components/ui/Spinner.tsx)
- [`EmptyState.tsx`](packages/fe/src/components/ui/EmptyState.tsx) — props: `heading`, `subtext?`, `ctaLabel?`, `onCta?`
- [`Input.tsx`](packages/fe/src/components/ui/Input.tsx)
- [`Textarea.tsx`](packages/fe/src/components/ui/Textarea.tsx)
- [`Select.tsx`](packages/fe/src/components/ui/Select.tsx)
- [`Toast.tsx`](packages/fe/src/components/ui/Toast.tsx)

### Layout

- [`AppShell.tsx`](packages/fe/src/components/layout/AppShell.tsx) — wraps every page
- [`PageContainer.tsx`](packages/fe/src/components/layout/PageContainer.tsx)

### Hooks

- [`useToast.ts`](packages/fe/src/hooks/useToast.ts) — `const toast = useToast(); toast.success('...'); toast.error('...')`
- [`useAuth.ts`](packages/fe/src/hooks/useAuth.ts) — `const { user, isAuthenticated } = useAuth()`
- [`useDebounce.ts`](packages/fe/src/hooks/useDebounce.ts) — `const debounced = useDebounce(value, 300)`

### API Hooks — ALL mutations and queries already exist. **Do not create new hook files.**

- [`useAdmin.ts`](packages/fe/src/api/hooks/useAdmin.ts): `useAdminCampaigns`, `useAdminUsers`, `useAdminConfig`, `useAdminRefundCampaign`, `useAdminHideCampaign`, `useAdminFlagCampaign`, `useAdminVerifyCoa`, `useAdminBanUser`, `useAdminManageClaim`, `useAdminUpdateConfig`, `useAdminFeeSweep`
- [`useLabs.ts`](packages/fe/src/api/hooks/useLabs.ts): `useLabs`, `useLabDetail`, `useTests`, `useApproveLab`, `useDeactivateLabTest`, `useDeactivateLab`, `useReactivateLab`, `useReactivateLabTest`, `useDisableTest`, `useEnableTest`, `useDeleteLab`, `useDeleteLabTest`, `useDeleteTest`, `useTestClaimTemplates`, `useCreateTestClaimTemplate`, `useDeleteTestClaimTemplate`
- [`usePeptides.ts`](packages/fe/src/api/hooks/usePeptides.ts): `useAllPeptides`, `useCreatePeptide`, `useUpdatePeptide`, `useApprovePeptide`, `useRejectPeptide`, `useDisablePeptide`, `useEnablePeptide`, `useDeletePeptide`
- [`useVendors.ts`](packages/fe/src/api/hooks/useVendors.ts): `useAllVendors`, `useCreateVendor`, `useUpdateVendor`, `useReviewVendor`, `useReinstateVendor`, `useDeleteVendor`

### Direct API clients (for lab/test mutations not in generated hooks)

- [`apiClient.ts`](packages/fe/src/api/apiClient.ts) exports: `labsApi`, `testsApi`, `adminApi`, `peptidesApi`, `vendorsApi`
- [`axiosInstance.ts`](packages/fe/src/api/axiosInstance.ts) — for endpoints not in generated client

### Types — import from `api-client` package

```ts
import type {
  CampaignDetailDto,
  LabDto,
  LabDetailDto,
  LabTestDto,
  TestDto,
  TestClaimTemplateDto,
  PeptideDto,
  VendorDto,
  UserDto,
  ConfigurationDto,
  ClaimKind,
  EndotoxinMode,
} from 'api-client';
```

### Utilities

- [`formatters.ts`](packages/fe/src/lib/formatters.ts) — `formatUSD(n)`
- [`badgeUtils.ts`](packages/fe/src/lib/badgeUtils.ts) — `campaignStatusVariant(status)`, `campaignStatusLabel(status)`
- [`queryKeys.ts`](packages/fe/src/api/queryKeys.ts) — query key registry

---

## API Reference

### Campaigns (via `adminApi` from `api-client`)

- `GET /admin/campaigns?status=&flagged=&page=&limit=` → `PaginatedResponseDto<CampaignDetailDto>`
- `POST /admin/campaigns/:id/refund` body: `{ reason: string }` → `CampaignDetailDto`
- `POST /admin/campaigns/:id/flag` body: `{ flagged: boolean, reason?: string }` → `CampaignDetailDto`
- `POST /admin/campaigns/:id/hide` body: `{ hidden: boolean }` → `CampaignDetailDto`

### Users (via `adminApi`)

- `GET /admin/users?search=&page=&limit=` → `PaginatedResponseDto<UserDto>`
- `POST /admin/users/:id/ban` body: `{ banned: boolean, reason?: string }` → `UserDto`
- `POST /admin/users/:id/claims` body: `{ claim_type: ClaimType, action: 'grant'|'revoke' }` → `UserDto`

### Config (via `adminApi`)

- `GET /admin/config` → `ConfigurationDto[]`
- `PUT /admin/config/:key` body: `{ value: unknown }` → `ConfigurationDto`

### Fee Sweep (via `adminApi`)

- `POST /admin/fee-sweep` body: `{ destination_address: string, currency: 'usdc'|'usdt' }` → `FeeSweepResponseDto`

### Labs (via `labsApi` from `api-client`)

- `GET /labs?approvedOnly=&activeOnly=&page=&limit=` → `PaginatedResponseDto<LabDto>`
- `GET /labs/:id` → `LabDetailDto` (includes `tests: LabTestDto[]`)
- `POST /labs` body: `CreateLabDto` → `LabDto`
- `PUT /labs/:id` body: `UpdateLabDto` → `LabDto`
- `POST /labs/:id/approve` → `LabDto`
- `POST /labs/:id/deactivate` → `LabDto`
- `POST /labs/:id/reactivate` → `LabDto`
- `POST /labs/:id/delete` (via `axiosInstance`) → void
- `POST /labs/:id/tests` body: `CreateLabTestDto` → `LabTestDto`
- `PUT /labs/:id/tests/:testId` body: `UpdateLabTestDto` → `LabTestDto`
- `POST /labs/:id/tests/:testId/deactivate` → void
- `POST /labs/:id/tests/:testId/reactivate` → void
- `POST /labs/:id/tests/:testId/delete` (via `axiosInstance`) → void

### Tests (via `testsApi` from `api-client`)

- `GET /tests?activeOnly=` → `TestDto[]`
- `POST /tests` body: `CreateTestDto` → `TestDto`
- `POST /tests/:id/disable` (via `axiosInstance`) → void
- `POST /tests/:id/enable` (via `axiosInstance`) → void
- `DELETE /tests/:id` (via `axiosInstance`) → void
- `GET /tests/:id/claim-templates` (via `axiosInstance`) → `TestClaimTemplateDto[]`
- `POST /tests/:id/claim-templates` body: `CreateTestClaimTemplateDto` (via `axiosInstance`) → `TestClaimTemplateDto`
- `DELETE /tests/claim-templates/:templateId` (via `axiosInstance`) → void

### Peptides (via `peptidesApi`)

- `GET /peptides/all?showUnreviewed=` → `PeptideDto[]`
- `POST /peptides/admin` body: `CreatePeptideDto` → `PeptideDto` (auto-approved)
- `PUT /peptides/:id` body: `UpdatePeptideDto` → `PeptideDto`
- `POST /peptides/:id/approve` → `PeptideDto`
- `POST /peptides/:id/reject` → void
- `POST /peptides/:id/disable` → `PeptideDto`
- `POST /peptides/:id/enable` → `PeptideDto`
- `DELETE /peptides/:id` → void

### Vendors (via `vendorsApi`)

- `GET /vendors/all?status=` → `VendorDto[]`
- `POST /vendors/admin` body: `CreateVendorDto` → `VendorDto` (auto-approved)
- `PUT /vendors/:id` body: `UpdateVendorDto` → `VendorDto`
- `POST /vendors/:id/review` body: `ReviewVendorDto` → `VendorDto`
- `POST /vendors/:id/reinstate` → `VendorDto`
- `DELETE /vendors/:id` → void

---

## Key Data Shapes (from schema & DTOs)

### `CampaignDetailDto` (relevant fields)

```ts
{
  id: string;
  title: string;
  status: 'created'|'funded'|'samples_sent'|'results_published'|'resolved'|'refunded';
  is_flagged_for_review: boolean;
  flagged_reason: string | null;
  is_hidden: boolean;
  current_funding_usd: number;
  funding_threshold_usd: number;
  verification_code: number;
  created_at: string;
  creator?: { id: string; username: string | null };
}
```

### `UserDto` (relevant fields)

```ts
{
  id: string;
  email: string;
  username: string | null;
  is_banned: boolean;
  email_verified: boolean;
  claims: string[];    // e.g. ['admin', 'contributor', 'campaign_creator']
  created_at: string;
  balance?: number;    // from ledger account
}
```

### `LabDto`

```ts
{
  (id, name, country, phone_number, address, is_approved, is_active, approved_at, created_at);
}
```

### `LabDetailDto`

```ts
LabDto & { tests: LabTestDto[] }
```

### `LabTestDto`

```ts
{
  id, lab_id, test_id, test_name,
  price_usd: number,
  typical_turnaround_days: number,
  vials_required: number,
  endotoxin_mode: 'exact_value'|'pass_fail',
  is_active: boolean
}
```

### `TestDto`

```ts
{
  id, name, description, usp_code: string|null,
  is_active: boolean, vials_required: number, created_at: string,
  claim_templates: TestClaimTemplateDto[]
}
```

### `TestClaimTemplateDto`

```ts
{
  id, test_id,
  claim_kind: 'mass'|'purity'|'identity'|'endotoxins'|'sterility'|'other',
  label: string, is_required: boolean, sort_order: number
}
```

### `PeptideDto`

```ts
{
  id, name, aliases: string[], description: string|null,
  is_active: boolean, approved_by: string|null, approved_at: string|null, created_at: string
}
```

### `VendorDto`

```ts
{
  id, name, website: string|null, country: string|null,
  telegram_group: string|null, contact_notes: string|null,
  status: 'pending'|'approved'|'rejected',
  submitted_by: string, reviewed_by: string|null, reviewed_at: string|null,
  review_notes: string|null, created_at: string
}
```

### `ConfigurationDto`

```ts
{ id, config_key: string, config_value: unknown, description: string, updated_at: string }
```

---

## Error Extraction Pattern

Use this exact helper in any file that calls mutations. Extract it once per file where needed — **do NOT copy it globally**.

```ts
function extractApiError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}
```

---

## Step-by-Step Execution Plan

Execute steps **in order**. Do not skip ahead. Complete each step fully before starting the next.

---

### STEP 1 — Delete the old file

Delete [`packages/fe/src/pages/AdminPage.tsx`](packages/fe/src/pages/AdminPage.tsx).

Then update [`packages/fe/src/routes/index.tsx`](packages/fe/src/routes/index.tsx):

- Change the import from `'../pages/AdminPage'` to `'../pages/admin/AdminPage'`
- No other changes to this file.

---

### STEP 2 — Create shared admin components

Create all files in `packages/fe/src/pages/admin/components/shared/`.

#### 2a. `AdminStatusBadge.tsx`

Single source of truth for all admin status badges. Map status strings to [`Badge`](packages/fe/src/components/ui/Badge.tsx) variants.

```
Props: { status: string }

Mapping:
  'approved'   → green    "Approved"
  'pending'    → amber    "Pending"
  'rejected'   → red      "Rejected"
  'active'     → teal     "Active"
  'disabled'   → gray     "Disabled"
  'unreviewed' → amber    "Unreviewed"
  'flagged'    → amber    "⚑ Flagged"
  'hidden'     → gray     "Hidden"
  'banned'     → red      "Banned"
  'unverified' → amber    "Unverified"
  'verified'   → green    "Email Verified"
  default      → gray     status (raw)
```

#### 2b. `AdminFilterBar.tsx`

Horizontal scrollable row of pill toggle buttons.

```
Props: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}
```

Each pill: `px-3 py-2 rounded-full border text-sm font-medium min-h-[36px]`. Active pill: `bg-primary-l border-primary text-primary`. Inactive: `border-border text-text-2 hover:border-text-3`. Wrap in `flex gap-2 flex-wrap`.

#### 2c. `AdminSectionHeader.tsx`

```
Props: { title: string; action?: React.ReactNode }
```

Renders `<div className="flex items-center justify-between mb-3">` with `<h3 className="text-base font-bold text-text">{title}</h3>` on the left and `{action}` on the right.

#### 2d. `AdminActionButton.tsx`

Thin wrapper around [`Button`](packages/fe/src/components/ui/Button.tsx) that enforces `size="sm"`.

```
Props: {
  variant?: 'ghost' | 'danger' | 'primary';
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}
```

Just renders `<Button variant={variant} size="sm" loading={loading} disabled={disabled} onClick={onClick}>{children}</Button>`. The only purpose is so every admin action button gets consistent `size="sm"` without repeating it.

#### 2e. `AdminConfirmModal.tsx`

Generic confirmation modal. **Used by every destructive action.**

```
Props: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}
```

Renders using [`Modal`](packages/fe/src/components/ui/Modal.tsx) with `isOpen={true}`. Body goes in a `<div className="space-y-4">`. Footer row: confirm button (variant from prop, `fullWidth`, `loading={isPending}`) + ghost Cancel button.

#### 2f. `AdminEmptyState.tsx`

```
Props: { message?: string }
```

Renders [`EmptyState`](packages/fe/src/components/ui/EmptyState.tsx) with `heading={message ?? 'Nothing here yet'}`.

---

### STEP 3 — Create `AdminPage.tsx` shell

Create `packages/fe/src/pages/admin/AdminPage.tsx`.

This file contains **only**:

1. Auth guard: if not admin, render `AppShell > PageContainer > EmptyState` with "Access Denied".
2. A `Tabs` component with 7 tabs: `Campaigns | Labs | Peptides | Vendors | Users | Config | Actions`.
3. Each tab `content` is just `<CampaignsTab />`, `<LabsTab />`, etc. — lazy-imported from `./tabs/`.
4. **Zero business logic, zero hooks (except `useAuth`), zero state except the tab selection which is inside `Tabs` itself.**

```ts
// Tab ids: 'campaigns' | 'labs' | 'peptides' | 'vendors' | 'users' | 'config' | 'actions'
// defaultTab: 'campaigns'
```

The page heading: `<h1 className="text-xl font-bold text-text mb-4">Admin Panel</h1>`.

---

### STEP 4 — Campaigns Tab

#### 4a. `CampaignRow.tsx`

File: `packages/fe/src/pages/admin/components/campaigns/CampaignRow.tsx`

Props:

```ts
{
  campaign: CampaignDetailDto;
  onFlag: (id: string) => void;
  onUnflag: (id: string) => void;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onRefund: (campaign: CampaignDetailDto) => void;
  onApproveResolution: (id: string) => void;
  isFlagPending: boolean;
  isHidePending: boolean;
}
```

Layout: `Card padding="md"`, horizontal flex, left region + right region.

**Left:**

- Campaign title (bold `text-sm`) as a link opening `/campaigns/:id` in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Creator username `text-xs text-text-2`
- Verification code: `<code className="text-xs font-mono bg-surface-a px-1.5 py-0.5 rounded text-text-3">{campaign.verification_code}</code>`
- Created date `text-xs text-text-3`

**Right (flex col, items-end, gap-2):**

- `AdminStatusBadge` with `status={campaign.status}`
- If `is_flagged_for_review`: `<Badge variant="amber">⚑ Flagged</Badge>`
- If `is_hidden`: `<Badge variant="gray">Hidden</Badge>`
- Action buttons row:
  - Always: `Flag`/`Unflag` (`AdminActionButton variant="ghost"`) + `Hide`/`Unhide` (`AdminActionButton variant="ghost"`)
  - If status is `'created'` or `'funded'`: + `Refund` (`AdminActionButton variant="danger"`)
  - If status is `'results_published'`: + `Approve Resolution` (`AdminActionButton variant="primary"`)

#### 4b. `CampaignFlagModal.tsx`

File: `packages/fe/src/pages/admin/components/campaigns/CampaignFlagModal.tsx`

Props: `{ campaignId: string; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean }`

Contains a form with a required `Reason` textarea (`rows={3}`). Submit button: amber (use `variant="primary"` — there is no amber variant for Button, primary is fine here) "Flag Campaign" + ghost Cancel. Validate that `reason.trim()` is non-empty before calling `onConfirm`.

#### 4c. `CampaignRefundModal.tsx`

File: `packages/fe/src/pages/admin/components/campaigns/CampaignRefundModal.tsx`

Props: `{ campaign: CampaignDetailDto; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean }`

Contains:

1. Warning card: `<div className="p-3 rounded-xl bg-amber-50 border border-amber-200">` with `⚠ This will refund all contributors and mark the campaign as refunded. This cannot be undone.`
2. Current funding: `<p className="text-sm text-text">Current funding: <strong>{formatUSD(campaign.current_funding_usd)}</strong></p>`
3. `Refund reason` textarea (required, `rows={3}`).
4. Footer: danger "Confirm Refund" + ghost "Cancel". Validate that reason is non-empty.

#### 4d. `CampaignsTab.tsx`

File: `packages/fe/src/pages/admin/tabs/CampaignsTab.tsx`

**This file fetches data and manages modal state. It does NOT contain any JSX for layout beyond the filter bar, search, and list.**

State:

```ts
const [statusFilter, setStatusFilter] = useState('');
const [flaggedOnly, setFlaggedOnly] = useState(false);
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);
const [flagModal, setFlagModal] = useState<string | null>(null); // campaignId
const [refundModal, setRefundModal] = useState<CampaignDetailDto | null>(null);
```

Data: `useAdminCampaigns({ status: statusFilter || undefined, flagged: flaggedOnly || undefined })`

Filter locally by `debouncedSearch` against `campaign.title` and `String(campaign.verification_code)`.

Mutations used: `useAdminFlagCampaign`, `useAdminHideCampaign`, `useAdminRefundCampaign`.

**"Unflag"** — no modal, call `flagCampaign({ id, dto: { flagged: false } })` directly, toast "Flag removed".
**"Flag"** — open `CampaignFlagModal`, on confirm call `flagCampaign({ id, dto: { flagged: true, reason } })`.
**"Hide"/"Unhide"** — direct call, toast accordingly.
**"Refund"** — open `CampaignRefundModal`, on confirm call `refundCampaign({ id, dto: { reason } })`.
**"Approve Resolution"** — no modal needed per spec (low risk), direct call to `adminApi.approveCampaignResolution` if endpoint exists, or skip for now and add a `// TODO` comment.

Layout:

1. `AdminFilterBar` with options: `All | created | funded | samples_sent | results_published | resolved | refunded` — use labels `All | Created | Funded | Samples Sent | Results Published | Resolved | Refunded`.
2. Row with `AdminFilterBar` + a "Flagged Only" toggle pill on the right.
3. Debounced search input `<input type="text" placeholder="Search by title or verification code..." ...>` with `className` including `w-full rounded-xl border border-border px-4 py-3 text-sm text-text bg-surface min-h-[44px]`.
4. `Spinner` while loading.
5. `AdminEmptyState` if no campaigns match.
6. `space-y-3` list of `CampaignRow` cards.
7. Modals rendered at the end of JSX.

---

### STEP 5 — Labs Tab

This is the most complex tab. Work through sub-components first, then assemble.

#### 5a. `DeleteLabModal.tsx`

File: `packages/fe/src/pages/admin/components/labs/DeleteLabModal.tsx`

Props: `{ labName: string; onConfirm: () => void; onClose: () => void; isPending: boolean }`

Uses `AdminConfirmModal` with body: `"{labName} will be permanently removed. This will fail if the lab still has test records attached."`, `confirmLabel="Delete Permanently"`, `confirmVariant="danger"`.

#### 5b. `AddTestToLabForm.tsx`

File: `packages/fe/src/pages/admin/components/labs/AddTestToLabForm.tsx`

Props:

```ts
{
  availableTests: TestDto[];
  onAdd: (data: { testId: string; price: string; days: string; vials: string; endotoxinMode: 'pass_fail'|'exact_value' }) => void;
  isLoading?: boolean;
}
```

An off-white `bg-surface-a rounded-xl p-3 space-y-2` container.

If `availableTests.length === 0`: render `<p className="text-xs text-text-3">No more tests available to add.</p>` only.

Otherwise:

- Test `<select>` (full width, rounded-xl, min-h-[44px])
- `<div className="flex gap-2">` with Price (`flex-1`, number, step 0.01), Days (`w-16`, number), Vials (`w-16`, number, min 1)
- Endotoxin mode `<select>` — only visible when the selected test has a `claim_templates` entry with `claim_kind === 'endotoxins'`. Options: `Pass/Fail` (value `pass_fail`) | `Exact Value (EU/mL)` (value `exact_value`).
- `Add` button (`AdminActionButton variant="primary"`) — disabled if any required field empty.

Local state: `selectedTestId`, `price`, `days`, `vials`, `endotoxinMode`.

Validation on "Add": all fields required, vials >= 1, price >= 0.01, days >= 1. Show inline `<p className="text-xs text-danger mt-1">...</p>` errors below each field.

#### 5c. `LabTestRow.tsx`

File: `packages/fe/src/pages/admin/components/labs/LabTestRow.tsx`

Props:

```ts
{
  labId: string;
  labTest: LabTestDto;
  onSaved: () => void;         // refetch lab detail
  mode: 'edit' | 'create';    // create = no per-row Save, row is just display + remove
  onRemoveFromPending?: () => void;  // create mode only
}
```

**Edit mode:**
Local state: `price`, `turnaround`, `vials`, `endotoxinMode`. Initialized from `labTest`.

Full row `opacity-50` when `!labTest.is_active`.

Layout: `flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-a`

- Test name (flex-1, `text-xs font-medium text-text truncate`). Append `" (Disabled)"` text if inactive, colored `text-text-3`.
- Price input `w-24` — `type="number" step="0.01"`. Required. Inline error "Price required".
- Days input `w-16` — `type="number"`. Required. Inline error "Days required".
- Vials input `w-16` — `type="number" min="1"`. **Required, min 1. Block Save if 0 or empty.** Inline error "Vials required".
- Endotoxin mode `<select className="w-36">` — only shown when `labTest` corresponds to a test that has an endotoxins claim template. Options: `Pass/Fail` / `Exact Value (EU/mL)`.
- `Save` button (`AdminActionButton variant="ghost"`) — disabled when any required field blank, when row inactive, or when same as original values.
- Right-side conditional:
  - If active → `<button className="text-danger text-xs font-medium min-h-[36px] px-2">Disable</button>` — calls `useDeactivateLabTest`
  - If inactive → `<button className="text-primary text-xs font-medium min-h-[36px] px-2">Reactivate</button>` (calls `useReactivateLabTest`) + `<button className="text-danger text-xs font-medium min-h-[36px] px-2">Delete</button>` (opens inline per-row state confirm, uses `useDeleteLabTest`)

For Save: call `labsApi.updateTest(labId, labTest.test_id, { price_usd, typical_turnaround_days, vials_required, endotoxin_mode })` directly. Toast "Test updated". Call `onSaved()`.

**Create mode:**
No Save button. Show all fields (price, days, vials, endotoxin mode) as display only — this row IS the data that will be submitted when the parent modal submits. Add a "Remove" button (`text-danger text-xs`).

#### 5d. `LabTestTable.tsx`

File: `packages/fe/src/pages/admin/components/labs/LabTestTable.tsx`

Props:

```ts
{
  mode: 'edit' | 'create';
  labId?: string;                          // edit mode
  labTests?: LabTestDto[];                 // edit mode
  pendingTests?: PendingLabTest[];         // create mode
  allTests: TestDto[];                     // for AddTestToLabForm availability
  onLabTestSaved?: () => void;             // edit mode — refetch
  onAddPending?: (t: PendingLabTest) => void;  // create mode
  onRemovePending?: (idx: number) => void;     // create mode
}
```

Where `PendingLabTest` is defined in the same file or a shared types file:

```ts
export interface PendingLabTest {
  testId: string;
  testName: string;
  price: string;
  days: string;
  vials: string;
  endotoxinMode: 'pass_fail' | 'exact_value';
}
```

Column header row: `Test | Price (USD) | Days | Vials | Actions` — `text-xs text-text-3 font-medium px-2 pb-1`.

In **edit mode**: renders `LabTestRow mode="edit"` for each `labTests` item. `AddTestToLabForm` at the bottom. Available tests = `allTests` active and not already in `labTests`.

In **create mode**: renders `LabTestRow mode="create"` + `onRemoveFromPending` for each `pendingTests` item. `AddTestToLabForm` at the bottom (no save is triggered immediately — `onAdd` calls `onAddPending` with the new `PendingLabTest`).

#### 5e. `LabModal.tsx`

File: `packages/fe/src/pages/admin/components/labs/LabModal.tsx`

Props:

```ts
{
  mode: 'create' | 'edit';
  lab?: LabDetailDto;
  allTests: TestDto[];
  onClose: () => void;
  onSaved?: () => void;
}
```

Uses [`Modal`](packages/fe/src/components/ui/Modal.tsx) with `title={mode === 'create' ? 'Add Lab' : \`Edit Lab: ${lab?.name}\`}`and`size="lg"`.

**Fields section:**

- Name (required), Country (required), Phone (optional), Address (optional).
- Per-field inline error messages.

**Tests section** (`LabTestTable`).

**Create mode flow:**

1. Local `pendingTests: PendingLabTest[]` state.
2. On "Create" click: validate name + country. If ok, call `labsApi.create({ name, country, phone_number?, address? })`. Then for each `pendingTest`, call `labsApi.addTest(createdId, { test_id, price_usd, typical_turnaround_days, vials_required, endotoxin_mode })`.
3. Toast "Lab created". Call `onClose()`. Call `onSaved?.()`.

**Edit mode flow:**

1. Fields pre-filled from `lab` prop.
2. On "Save": call `labsApi.update(lab.id, { name, country, phone_number?, address? })`.
3. Toast "Lab updated". Call `onClose()`. Call `onSaved?.()`.

Footer: ghost "Cancel" + primary "Create"/"Save" with `loading` state.

**Validation rule:** If any `pendingTest` has `vials === '' || Number(vials) < 1`, block submission with a `toast.error('All tests require at least 1 vial')`.

#### 5f. `LabRow.tsx`

File: `packages/fe/src/pages/admin/components/labs/LabRow.tsx`

Props:

```ts
{
  lab: LabDto;
  onEdit: (labId: string) => void;
  onDelete: (lab: LabDto) => void;
}
```

`Card padding="md"` with `className={!lab.is_active ? 'opacity-60' : ''}`.

**Left:** Name (bold `text-sm`) + Country (`text-xs text-text-2`)

**Right (flex items-center gap-2):**

- `AdminStatusBadge status={lab.is_approved ? 'approved' : 'pending'}`
- If `!lab.is_active`: `<Badge variant="gray">Disabled</Badge>`
- Buttons vary by state:
  - Active + not approved: `Approve` (`AdminActionButton variant="primary"`)
  - Active + approved: `Edit` (ghost) + `Disable` (ghost)
  - Inactive: `Reactivate` (ghost) + `Delete` (danger)

`Approve` — direct API via `useApproveLab`, toast `"{name} approved"`.
`Disable` — direct API via `useDeactivateLab`, toast `"{name} disabled"`.
`Reactivate` — direct API via `useReactivateLab`.
`Edit` — calls `onEdit(lab.id)`.
`Delete` — calls `onDelete(lab)`.

Note: the [`useDeactivateLab`](packages/fe/src/api/hooks/useLabs.ts), [`useReactivateLab`](packages/fe/src/api/hooks/useLabs.ts), [`useApproveLab`](packages/fe/src/api/hooks/useLabs.ts) hooks are called directly inside this component — no need to lift them up.

#### 5g. `LabList.tsx`

File: `packages/fe/src/pages/admin/components/labs/LabList.tsx`

Props: `{ labs: LabDto[]; onEdit: (labId: string) => void; onDelete: (lab: LabDto) => void }`

Renders `AdminEmptyState` if empty, otherwise `<div className="space-y-3">` of `LabRow`.

#### 5h. `TestClaimTemplateRow.tsx`

File: `packages/fe/src/pages/admin/components/tests/TestClaimTemplateRow.tsx`

Props:

```ts
{
  template?: TestClaimTemplateDto;   // undefined = new row
  testId: string;
  onSaved: () => void;
  onRemove: () => void;
}
```

**Existing template (template defined):**
Inline editable row: `ClaimKind` select, Label input, Required checkbox, Sort order input, `Save` button (ghost sm), red `Remove` text button.
Save calls `axiosInstance.patch(\`/tests/claim-templates/${template.id}\`, { label, is_required, sort_order })`then`onSaved()`.
Remove calls `useDeleteTestClaimTemplate`then`onRemove()`.

**New row (template undefined):**
Same fields but Save button label is "Add". On Add: call `useCreateTestClaimTemplate({ testId, claim_kind, label, is_required, sort_order })`. On success: call `onSaved()`. The row then becomes read-only or disappears (parent re-renders).

Layout: `flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0`.

#### 5i. `TestClaimTemplateList.tsx`

File: `packages/fe/src/pages/admin/components/tests/TestClaimTemplateList.tsx`

Props: `{ testId: string; templates: TestClaimTemplateDto[]; onChanged: () => void }`

Renders each template as `TestClaimTemplateRow`. Has `"+ Add Claim Template"` teal text button at bottom that appends a new blank (`template=undefined`) `TestClaimTemplateRow`.

State: `showNewRow: boolean`.

#### 5j. `TestCatalogRow.tsx`

File: `packages/fe/src/pages/admin/components/tests/TestCatalogRow.tsx`

Props: `{ test: TestDto; onDisable: (t: TestDto) => void; onDelete: (t: TestDto) => void }`

`flex items-start justify-between px-0 py-3 border-b border-border` with `opacity-60` when inactive.

**Left:** Name (bold `text-sm`) + Description (`text-xs text-text-2`).

**Right:**

- `AdminStatusBadge status={test.is_active ? 'active' : 'disabled'}`
- Active → `Disable` (ghost sm) — calls `onDisable(test)`.
- Inactive → `Enable` (ghost sm) direct + `Delete` (danger sm) — calls `onDelete(test)`.

Below: expandable `"▶ Claim Templates ({n})"` disclosure button (`text-xs text-primary font-medium`). When open, renders `TestClaimTemplateList`.

State: `showTemplates: boolean`.

Query: `useTestClaimTemplates(showTemplates ? test.id : '')` — only fetch when expanded. Note: `test.claim_templates` from the test list already has the count for the badge; use that for the count label. Use `useTestClaimTemplates` for the full editable list when expanded.

#### 5k. `TestCatalog.tsx`

File: `packages/fe/src/pages/admin/components/tests/TestCatalog.tsx`

Props: `{ tests: TestDto[]; onDisable: (t: TestDto) => void; onDelete: (t: TestDto) => void }`

Renders `AdminSectionHeader title="Test Catalog"`. If empty: `AdminEmptyState`. Otherwise: `<div className="divide-y divide-border">` of `TestCatalogRow`.

#### 5l. `CreateTestModal.tsx`

File: `packages/fe/src/pages/admin/components/tests/CreateTestModal.tsx`

Props: `{ onClose: () => void; onCreated?: () => void }`

Fields: Name (required), Description (3-row textarea, required), USP Code (optional), Vials Required (number, default 1, min 1, required).

Divider. **Claim Templates section** — local state `pendingTemplates: Array<{claim_kind, label, is_required, sort_order}>`. Has `"+ Add Claim Template"` button toggling a new pending row. Each pending row rendered inline (not using `TestClaimTemplateRow` since that's for server-persisted rows — render inline here). Each row has a "Remove" button.

Validation on Create:

- Name + Description + Vials required.
- Any partial pending template (kind but no label, or label but no kind) → toast error "Complete all claim template fields first".

On Create: call `testsApi.createTest({ name, description, usp_code?, vials_required })`, then for each pending template call `axiosInstance.post(\`/tests/${id}/claim-templates\`, template)`. Toast "Test created". Call `onCreated?.()`. `onClose()`.

Footer: primary "Create" + ghost "Cancel".

#### 5m. `DisableTestModal.tsx`

File: `packages/fe/src/pages/admin/components/tests/DisableTestModal.tsx`

Props: `{ test: TestDto; onClose: () => void; onConfirm: () => void; isPending: boolean }`

Uses `AdminConfirmModal` with body: `"Disabling {test.name} will immediately deactivate this test across all labs that currently offer it."`, `confirmLabel="Disable Everywhere"`, `confirmVariant="danger"`.

#### 5n. `DeleteTestModal.tsx`

File: `packages/fe/src/pages/admin/components/tests/DeleteTestModal.tsx`

Props: `{ test: TestDto; onClose: () => void; onConfirm: () => void; isPending: boolean }`

Uses `AdminConfirmModal` with body as `ReactNode`:

```tsx
<div className="space-y-3">
  <div className="p-3 rounded-xl bg-surface-a border border-border">
    <p className="text-sm font-bold text-danger mb-1">Permanent Deletion</p>
    <p className="text-sm text-text">
      {test.name} will be permanently removed from the test catalog.
    </p>
  </div>
  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
    <p className="text-sm font-bold text-warning mb-1">⚠ Lab cascade</p>
    <p className="text-sm text-text-2">
      This test will be automatically removed from every lab that lists it. Only blocked if the test
      has been used in an active campaign.
    </p>
  </div>
</div>
```

`confirmLabel="Delete Permanently"`, `confirmVariant="danger"`.

#### 5o. `LabsTab.tsx`

File: `packages/fe/src/pages/admin/tabs/LabsTab.tsx`

State:

```ts
const [showDisabled, setShowDisabled] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [showCreateLab, setShowCreateLab] = useState(false);
const [showCreateTest, setShowCreateTest] = useState(false);
const [editLabId, setEditLabId] = useState<string | null>(null);
const [deleteLabTarget, setDeleteLabTarget] = useState<LabDto | null>(null);
const [disableTestTarget, setDisableTestTarget] = useState<TestDto | null>(null);
const [deleteTestTarget, setDeleteTestTarget] = useState<TestDto | null>(null);
```

Queries:

- `useLabs(false, !showDisabled)` — note: `activeOnly = !showDisabled`
- `useTests(!showDisabled)` — note: `activeOnly = !showDisabled`
- `useLabDetail(editLabId ?? '')` — fetch detail when editing
- `useDeleteLab`, `useDisableTest`, `useEnableTest`, `useDeleteTest`

**Top action bar:**

- `Actions` dropdown button (`AdminActionButton variant="primary"`) → dropdown with "Add Lab" and "Add Test".
- "Show Disabled" toggle pill.

**Section 1 — Labs list:**
`AdminSectionHeader title="Labs"`. `LabList` component. On lab Edit: `setEditLabId(lab.id)`. On lab Delete: `setDeleteLabTarget(lab)`.

**Section 2 — Test Catalog** (separated by `<hr className="border-border my-4" />`):
`TestCatalog` component. `onDisable(test)` → `setDisableTestTarget(test)`. `onDelete(test)` → `setDeleteTestTarget(test)`.

**Modals rendered at end of JSX:**

- `showCreateLab && <LabModal mode="create" allTests={tests} onClose={...} onSaved={...} />`
- `showCreateTest && <CreateTestModal onClose={...} onCreated={...} />`
- `editLabId && editLabDetail && <LabModal mode="edit" lab={editLabDetail} allTests={tests} onClose={...} onSaved={...} />`
- `deleteLabTarget && <DeleteLabModal labName={deleteLabTarget.name} onConfirm={...} onClose={...} isPending={...} />`
- `disableTestTarget && <DisableTestModal test={disableTestTarget} onClose={...} onConfirm={...} isPending={...} />`
- `deleteTestTarget && <DeleteTestModal test={deleteTestTarget} onClose={...} onConfirm={...} isPending={...} />`

---

### STEP 6 — Peptides Tab

#### 6a. `RejectPeptideModal.tsx`

File: `packages/fe/src/pages/admin/components/peptides/RejectPeptideModal.tsx`

Props: `{ peptide: PeptideDto; onClose: () => void; onConfirm: (notes?: string) => void; isPending: boolean }`

Uses `AdminConfirmModal`. Body:

```tsx
<div className="space-y-3">
  <p className="text-sm text-text">Submitter will be notified of the rejection.</p>
  <div>
    <label className="text-sm font-medium text-text block mb-1">Review Notes (optional)</label>
    <Textarea value={notes} onChange={...} rows={3} placeholder="Reason for rejection..." />
  </div>
</div>
```

`confirmLabel="Reject"`, `confirmVariant="danger"`. Notes textarea is local state.

#### 6b. `PeptideModal.tsx`

File: `packages/fe/src/pages/admin/components/peptides/PeptideModal.tsx`

Props: `{ mode: 'create'|'edit'; peptide?: PeptideDto; onClose: () => void; onSaved?: () => void }`

Fields:

- Name (required)
- Aliases: tag-style multi-input. Render existing as `<span className="inline-flex items-center gap-1 bg-primary-l text-primary text-xs px-2 py-1 rounded-full">` with an `×` remove button. Input for adding new alias on Enter or comma key.
- Description textarea (optional)
- Active toggle — **only in edit mode**.

Create: call `peptidesApi.createPeptide({ name, aliases, description?: ... })`. Toast "Peptide created".
Edit: call `peptidesApi.updatePeptide(peptide.id, { name, aliases, description, is_active })`. Toast "Peptide updated".

#### 6c. `PeptideRow.tsx`

File: `packages/fe/src/pages/admin/components/peptides/PeptideRow.tsx`

Props:

```ts
{
  peptide: PeptideDto;
  onEdit: (p: PeptideDto) => void;
  onReject: (p: PeptideDto) => void;
}
```

`Card padding="sm"`. Mutations called directly: `useApprovePeptide`, `useDisablePeptide`, `useEnablePeptide`, `useDeletePeptide`.

**Left:** Name (bold) + aliases (`text-xs text-text-2` comma-separated) + description (1-line truncated, `line-clamp-1 text-xs text-text-3`) with `title` attr for tooltip.

**Right:** Status badge + buttons:

Determine state:

- `!is_active && approved_at === null` → **Unreviewed**: `Approve` (primary) + `Reject` (danger ghost → calls `onReject`)
- `is_active` → **Active**: `Edit` (ghost → calls `onEdit`) + `Disable` (ghost → direct mutation)
- `!is_active && approved_at !== null` → **Disabled**: `Enable` (ghost → direct) + `Delete` (danger → direct, blocked by API if FK)

Status badge: unreviewed → `amber "Unreviewed"`, active → `teal "Active"`, disabled → `gray "Disabled"`.

`Approve` — direct: `useApprovePeptide`, toast `"{name} approved"`.
`Delete` — use `AdminConfirmModal` inline (local `showDeleteConfirm` state).

#### 6d. `PeptidesTab.tsx`

File: `packages/fe/src/pages/admin/tabs/PeptidesTab.tsx`

State: `showUnreviewed`, `showCreate`, `editTarget: PeptideDto | null`, `rejectTarget: PeptideDto | null`.

Queries: `useAllPeptides(showUnreviewed)`.

Layout:

1. Top action bar: `"Add Peptide"` primary button + `"Show Unreviewed"` toggle pill.
2. `PeptideModal` for create (when `showCreate`).
3. `PeptideModal mode="edit"` (when `editTarget`).
4. `Spinner` / `AdminEmptyState` / `space-y-3` list of `PeptideRow`.
5. `RejectPeptideModal` (when `rejectTarget`).

---

### STEP 7 — Vendors Tab

#### 7a. `RejectVendorModal.tsx`

File: `packages/fe/src/pages/admin/components/vendors/RejectVendorModal.tsx`

Props: `{ vendor: VendorDto; onClose: () => void; onConfirm: (notes: string) => void; isPending: boolean }`

`review_notes` textarea is **required** (minimum 1 character). Block confirm until filled. Uses `AdminConfirmModal`. `confirmLabel="Reject Vendor"`, `confirmVariant="danger"`.

#### 7b. `VendorModal.tsx`

File: `packages/fe/src/pages/admin/components/vendors/VendorModal.tsx`

Props: `{ mode: 'create'|'edit'; vendor?: VendorDto; onClose: () => void; onSaved?: () => void }`

Fields: Name (required), Website (optional), Country (optional), Telegram Group (optional), Contact Notes (optional, textarea).

Edit mode only: Status `<select>` with options `approved | pending | rejected`.

Create: `vendorsApi.createVendor({ name, website?, country?, telegram_group?, contact_notes? })`. Toast "Vendor created".
Edit: `vendorsApi.updateVendor(vendor.id, { name, website, country, telegram_group, contact_notes, status? })`. Toast "Vendor updated".

#### 7c. `VendorRow.tsx`

File: `packages/fe/src/pages/admin/components/vendors/VendorRow.tsx`

Props:

```ts
{
  vendor: VendorDto;
  onEdit: (v: VendorDto) => void;
  onReject: (v: VendorDto) => void;
  onSuspend: (v: VendorDto) => void;
  onDelete: (v: VendorDto) => void;
}
```

Mutations called directly: `useReviewVendor`, `useReinstateVendor`.

**Left:** Name (bold) + Website + Country (`text-xs text-text-2`) + `"Submitted by {submitted_by_id}"` + date.

**Right:** Status badge + buttons by state:

- `pending`: `Approve` (primary, direct `reviewVendor({ id, dto: { status: 'approved' } })`) + `Reject` (danger ghost → `onReject`)
- `approved`: `Edit` (ghost → `onEdit`) + `Suspend` (ghost → `onSuspend`)
- `rejected`: `Reinstate` (ghost, direct `reinstateVendor`) + `Delete` (danger → `onDelete`)

#### 7d. `VendorList.tsx`

File: `packages/fe/src/pages/admin/components/vendors/VendorList.tsx`

Props: `{ vendors: VendorDto[]; onEdit(...); onReject(...); onSuspend(...); onDelete(...) }`

`AdminEmptyState` if empty, else `space-y-3` list of `VendorRow`.

#### 7e. `VendorsTab.tsx`

File: `packages/fe/src/pages/admin/tabs/VendorsTab.tsx`

State: `statusFilter: ''|'pending'|'approved'|'rejected'`, `showCreate`, `editTarget`, `rejectTarget`, `suspendTarget`, `deleteTarget`.

Queries: `useAllVendors(statusFilter || undefined)`.
Mutations: `useReviewVendor`, `useDeleteVendor`.

Layout:

1. Top action bar: `"Add Vendor"` primary + `AdminFilterBar` with `All | Pending | Approved | Rejected`.
2. `Spinner` / empty / `VendorList`.
3. Modals: `VendorModal create`, `VendorModal edit`, `RejectVendorModal`, `AdminConfirmModal` for suspend, `AdminConfirmModal` for delete.

**Suspend** → `AdminConfirmModal` body: `"Suspending {name} will mark them as rejected. Campaigns using this vendor are not affected."` `confirmLabel="Suspend"` `confirmVariant="danger"`. On confirm: `reviewVendor({ id, dto: { status: 'rejected' } })`.

**Delete** → `AdminConfirmModal`. On confirm: `deleteVendor(id)`.

---

### STEP 8 — Users Tab

#### 8a. `BanUserModal.tsx`

File: `packages/fe/src/pages/admin/components/users/BanUserModal.tsx`

Props: `{ user: UserDto; onClose: () => void; onConfirm: () => void; isPending: boolean }`

Uses `AdminConfirmModal`. Body: `"Banning {user.username ?? user.email} will immediately revoke all active sessions."` `confirmLabel="Ban User"` `confirmVariant="danger"`.

#### 8b. `UserDetailModal.tsx`

File: `packages/fe/src/pages/admin/components/users/UserDetailModal.tsx`

Props: `{ user: UserDto; onClose: () => void }`

Read-only modal. Shows:

- Email, username, joined date.
- Email verified badge / Unverified badge.
- Balance (`user.balance ?? 0` formatted with `formatUSD`).
- Claims list: one `<Badge>` per claim string.

Uses `Modal size="md"`. No editing in this modal.

#### 8c. `UserRow.tsx`

File: `packages/fe/src/pages/admin/components/users/UserRow.tsx`

Props:

```ts
{
  user: UserDto;
  onBan: (u: UserDto) => void;
  onView: (u: UserDto) => void;
}
```

`Card padding="sm"`.

**Left:** Username (bold) + email (`text-xs text-text-2`) + joined date (`text-xs text-text-3`).

**Right:**

- `email_verified ? <Badge variant="green">Email Verified</Badge> : <Badge variant="amber">Unverified</Badge>`
- `user.is_banned && <Badge variant="red">Banned</Badge>`
- `View` ghost button → `onView(user)`
- Active user: `Ban` danger ghost → `onBan(user)`
- Banned user: `Unban` ghost → direct `useAdminBanUser({ id, dto: { banned: false } })`

#### 8d. `UserList.tsx`

File: `packages/fe/src/pages/admin/components/users/UserList.tsx`

Props: `{ users: UserDto[]; onBan(...); onView(...) }`

`AdminEmptyState` if empty, else `space-y-2` list of `UserRow`.

#### 8e. `UsersTab.tsx`

File: `packages/fe/src/pages/admin/tabs/UsersTab.tsx`

State: `search`, `filter: 'all'|'banned'|'unverified'`, `banTarget: UserDto | null`, `viewTarget: UserDto | null`.

Queries: `useAdminUsers(debouncedSearch)`. Use `useDebounce(search, 300)`.

Filter pills: `All | Banned | Unverified`. Apply client-side after fetch: filter by `user.is_banned` for "banned", by `!user.email_verified` for "unverified".

Mutations: `useAdminBanUser`.

Layout:

1. Search input.
2. `AdminFilterBar` for `all | banned | unverified`.
3. `Spinner` / `UserList`.
4. `BanUserModal` (when `banTarget`).
5. `UserDetailModal` (when `viewTarget`).

---

### STEP 9 — Config Tab

#### 9a. `ConfigRow.tsx`

File: `packages/fe/src/pages/admin/components/config/ConfigRow.tsx`

Props: `{ cfg: ConfigurationDto; onSave: (value: unknown) => Promise<void>; isSaving: boolean }`

`Card padding="md"`.

**Left in header:** `config_key` in `font-mono font-bold text-sm` + `description` in `text-xs text-text-2`.

**Right in header:** nothing (Save button goes in footer).

**Input area** — adapt to value type:

- `boolean` → toggle switch (same pattern as existing `ConfigSection` in the old file)
- `number` → `<input type="number" step="0.01">`
- `string` → `<input type="text">`
- `object` (non-array) → per-key inputs, adapting type per original value type
- `array` → tag chip list with add/remove inputs
- Other → `<textarea>` JSON editor

**Footer row:** `<p className="text-xs text-text-3">Updated: {cfg.updated_at.slice(0,10)}</p>` on left. `Save` ghost sm button on right — shows spinner while `isSaving`, disabled when no changes.

No confirmation modal needed for config saves (spec says ghost Save button only).

#### 9b. `ConfigTab.tsx`

File: `packages/fe/src/pages/admin/tabs/ConfigTab.tsx`

Queries: `useAdminConfig()`.
Mutations: `useAdminUpdateConfig()`.

Layout: `Spinner` / `AdminEmptyState` / `space-y-3` list of `ConfigRow`.

Each `ConfigRow.onSave` calls `updateConfig({ key: cfg.config_key, dto: { value } })`, toasts "Config updated" on success.

---

### STEP 10 — Actions Tab

#### 10a. `ActionsTab.tsx`

File: `packages/fe/src/pages/admin/tabs/ActionsTab.tsx`

Contains only the **Manual Fee Sweep** card for now.

State: `destinationAddress: string`, `showConfirm: boolean`.
Mutations: `useAdminFeeSweep()`.
Queries: `useAdminConfig()` — extract `fee_account_balance` from config if it exists, or show "N/A".

**Fee Sweep Card** (`Card padding="md"`):

- Heading: `"Manual Fee Sweep"` bold.
- Description: `"Transfer accumulated platform fees from the fee account to the master wallet."` `text-sm text-text-2`.
- Fee account balance display (query from config or show "N/A").
- Address input (`font-mono`, fullwidth, `min-h-[44px]`).
- `"Run Fee Sweep"` primary button → opens `AdminConfirmModal`.

`AdminConfirmModal` body: `"This will sweep all USDC and USDT fees to the specified address. This cannot be undone."` `confirmLabel="Run Fee Sweep"` `confirmVariant="primary"`.

On confirm: call `sweepFees({ destination_address, currency: 'usdc' })` then `sweepFees({ destination_address, currency: 'usdt' })`. Toast each result. Reset confirm modal.

---

### STEP 11 — Final Assembly

Verify `packages/fe/src/pages/admin/AdminPage.tsx` imports all 7 tab components correctly:

```ts
import { CampaignsTab } from './tabs/CampaignsTab';
import { LabsTab } from './tabs/LabsTab';
import { PeptidesTab } from './tabs/PeptidesTab';
import { VendorsTab } from './tabs/VendorsTab';
import { UsersTab } from './tabs/UsersTab';
import { ConfigTab } from './tabs/ConfigTab';
import { ActionsTab } from './tabs/ActionsTab';
```

Verify `packages/fe/src/routes/index.tsx` imports from `'../pages/admin/AdminPage'`.

---

## Complete File Tree to Create

```
packages/fe/src/pages/admin/
  AdminPage.tsx
  tabs/
    CampaignsTab.tsx
    LabsTab.tsx
    PeptidesTab.tsx
    VendorsTab.tsx
    UsersTab.tsx
    ConfigTab.tsx
    ActionsTab.tsx
  components/
    shared/
      AdminStatusBadge.tsx
      AdminActionButton.tsx
      AdminConfirmModal.tsx
      AdminFilterBar.tsx
      AdminEmptyState.tsx
      AdminSectionHeader.tsx
    campaigns/
      CampaignRow.tsx
      CampaignFlagModal.tsx
      CampaignRefundModal.tsx
    labs/
      LabList.tsx
      LabRow.tsx
      LabModal.tsx
      LabTestTable.tsx
      LabTestRow.tsx
      AddTestToLabForm.tsx
      DeleteLabModal.tsx
    tests/
      TestCatalog.tsx
      TestCatalogRow.tsx
      TestClaimTemplateList.tsx
      TestClaimTemplateRow.tsx
      CreateTestModal.tsx
      DisableTestModal.tsx
      DeleteTestModal.tsx
    peptides/
      PeptideList.tsx
      PeptideRow.tsx
      PeptideModal.tsx
      RejectPeptideModal.tsx
    vendors/
      VendorList.tsx
      VendorRow.tsx
      VendorModal.tsx
      RejectVendorModal.tsx
    users/
      UserList.tsx
      UserRow.tsx
      UserDetailModal.tsx
      BanUserModal.tsx
    config/
      ConfigRow.tsx
```

> Note: `PeptideList.tsx` and `VendorList.tsx` are thin wrappers (< 30 lines) — include them for consistency.

---

## Checklist Before Marking Any File "Done"

For **each file**, verify:

- [ ] No TypeScript errors (no `any`, no implicit `any`, all return types explicit)
- [ ] No `eslint-disable` comments
- [ ] No hardcoded hex colors
- [ ] All destructive actions go through `AdminConfirmModal` (not `confirm()`)
- [ ] All interactive elements are `min-h-[44px]` (or `min-h-[36px]` in allowed dense rows)
- [ ] File is under ~200 lines
- [ ] No modal logic inside tab files
- [ ] No query hooks (`useQuery`) called inside row components that render in infinite lists — queries belong in tab-level or modal-level components
- [ ] All imports resolve correctly (no relative path guessing — use the exact paths shown in this document)

---

## Common Mistakes to Avoid

1. **Do not use `window.confirm()` or `window.prompt()`** — always `AdminConfirmModal`.
2. **Do not create new hooks files** — all hooks already exist. Just import.
3. **Do not call API functions directly in components** — use the pre-built mutation hooks. The only exception is `labsApi.updateTest(...)` inside `LabTestRow` for per-row save (the hook doesn't support per-row update with `isPending` tracking easily).
4. **Do not add `key={index}` to lists** — always use stable IDs (`key={lab.id}`, `key={test.id}`, `key={template.id}`). Only `pendingTests[index]` in create mode may use index as a last resort.
5. **Do not import from `'../../../api/hooks/useLabs'` with wrong relative depth** — calculate the relative path from the component's actual location.
6. **Do not create a `types.ts` shared file** — the only shared type to export is `PendingLabTest` from `LabTestTable.tsx` (imported by `LabModal.tsx`).
7. **Do not render modals conditionally with `&&` when the modal itself controls `isOpen`** — `AdminConfirmModal` always sets `isOpen={true}` when rendered; use conditional rendering (`{target && <Modal ... />}`) as the gate.
8. **TagInput for aliases is raw inputs, not a library** — implement the comma/Enter chip input yourself in ~20 lines.
