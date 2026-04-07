# FE Rewrite — Master Index

> **Goal:** Full rewrite of all user-facing pages. Every file listed under "nuke" below is **deleted** and rewritten from scratch. Agents do not read the old versions — they receive only this spec and the stable infrastructure files (listed below).

---

## Nuke Strategy

### Step 0 — Delete before starting any story

Run this once before any story agent begins:

```bash
# Delete all existing user-facing pages (flat files + legacy folders)
rm -f packages/fe/src/pages/HomePage.tsx
rm -f packages/fe/src/pages/CampaignDetailPage.tsx
rm -f packages/fe/src/pages/CreateCampaignPage.tsx
rm -f packages/fe/src/pages/MyCampaignsPage.tsx
rm -f packages/fe/src/pages/WalletPage.tsx
rm -f packages/fe/src/pages/AccountPage.tsx
rm -f packages/fe/src/pages/UserPage.tsx

# Delete existing campaign component (rebuilt in S01)
rm -f packages/fe/src/components/campaigns/CampaignCard.tsx

# Delete existing wizard comboboxes only if they don't work —
# S08 will reuse them if they're fine, replace them if not
# DO NOT delete: src/components/wizard/PeptideCombobox.tsx
# DO NOT delete: src/components/wizard/VendorCombobox.tsx
```

**Then update `src/routes/index.tsx` directly** — no re-export shims anywhere. Each story specifies the new import path.

### What is NOT nuked (stable infrastructure — agents can import freely)

```
src/components/ui/           ← keep as-is (Button, Card, Badge, Modal, Sheet, etc.)
src/components/layout/       ← keep AppShell, BottomNav, PageContainer
                               TopBar.tsx is REWRITTEN in S02 (delete old, write fresh)
src/components/wizard/       ← keep PeptideCombobox, VendorCombobox (S08 reuses)
src/api/hooks/               ← keep all existing hooks; stories ADD new ones, never delete
src/api/apiClient.ts         ← keep
src/api/axiosInstance.ts     ← keep
src/api/queryClient.ts       ← keep
src/api/queryKeys.ts         ← keep (stories may add keys)
src/lib/                     ← keep (badgeUtils, formatters, validators)
src/hooks/                   ← keep (useAuth, useDebounce, useToast)
src/context/                 ← keep (AuthContext, toast-context)
src/config.ts                ← keep
src/index.css                ← keep
```

### Admin panel — already done, do not touch

```
src/pages/admin/             ← complete, skip entirely
```

---

## Stable Infrastructure Every Agent Needs to Know

### Color tokens (from `src/index.css` `@theme`)

```
bg-primary       #0D9488    buttons, links, active, focus
bg-primary-d     #0F766E    button hover
bg-primary-l     #CCFBF1    ghost hover, tint
bg-bg            #F5F4F1    page background
bg-surface       #FFFFFF    cards, modals, inputs
bg-surface-a     #FAFAF9    secondary areas, secondary button hover
border-border    #E7E5E4    all borders
text-text        #1C1917    body
text-text-2      #78716C    secondary
text-text-3      #A8A29E    tertiary / placeholders
text-success     #059669
text-warning     #D97706
text-danger      #DC2626
text-info        #2563EB
```

### Hard rules for every file written

- Icons → `lucide-react` (never raw SVG in new code)
- No hardcoded hex — semantic tokens or Tailwind palette
- All interactive elements → `min-h-[44px]` (exception: filter pills can be 36 px in dense rows)
- All API types → import from `api-client` — never define your own API shapes
- No `any`, no `@ts-ignore`, no `console.log`
- All server state → TanStack Query hooks
- Auth state → `useAuth()` only

---

## Why

| Page                          | Lines | Problem                                            |
| ----------------------------- | ----- | -------------------------------------------------- |
| `CreateCampaignPage.tsx`      | 1 215 | entire 3-step wizard in one file                   |
| `CampaignDetailPage.tsx`      | 1 077 | all tabs + all action sheets in one file           |
| `WalletPage.tsx`              | 332   | everything inline                                  |
| `MyCampaignsPage.tsx`         | 323   | everything inline                                  |
| No shared campaign components | —     | status badges, funding cards duplicated everywhere |

---

## Execution Order & Dependency Graph

```
S01 (Shared campaign components — new CampaignCard, StatusBadge, FundingCard, etc.)
S02 (Notification hooks + entirely new TopBar with bell)
   │
   ├──► S03 (HomePage)
   │
   ├──► S04 (CampaignDetail shell + tabs) ─► S05 (Samples tab) ─► S06 (Action sheets)
   │
   ├──► S07 (Create wizard shell + Step 1) ─► S08 (Step 2) ─► S09 (Step 3)
   │
   ├──► S10 (MyCampaignsPage)
   ├──► S11 (WalletPage)
   └──► S12 (AccountPage)
```

**S01 and S02 must finish before anyone else.** After that S03–S12 parallelise freely, with the sequential chains shown above within their groups.

---

## Stories

| ID                                         | Title                              | Depends on | Key new files                                                                                              |
| ------------------------------------------ | ---------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| [S01](./S01-shared-campaign-components.md) | Shared campaign display components | —          | `CampaignStatusBadge`, `COAStatusChip`, `FundingCard`, `ReactionBar`, `CampaignCard`                       |
| [S02](./S02-notification-topbar.md)        | Notification hooks + new TopBar    | —          | `useNotifications`, `NotificationCenter`, `NotificationItem`, rewritten `TopBar`                           |
| [S03](./S03-home-page.md)                  | HomePage                           | S01        | `FeedFilters`, `CampaignFeed`, `HomePage`                                                                  |
| [S04](./S04-campaign-detail-shell.md)      | CampaignDetail shell + tabs        | S01        | `CampaignDetailPage`, `CampaignHero`, `CreatorActions`, 4 tab files                                        |
| [S05](./S05-campaign-detail-samples.md)    | CampaignDetail Samples tab         | S04        | `SamplesTab`, `SampleCard`, `COAStateDisplay`                                                              |
| [S06](./S06-campaign-detail-sheets.md)     | CampaignDetail action sheets       | S05        | 5 sheet files                                                                                              |
| [S07](./S07-create-campaign-step1.md)      | Create wizard shell + Step 1       | —          | `types.ts`, `useDraftStorage`, `WizardProgress`, `Step1Basics`, orchestrator                               |
| [S08](./S08-create-campaign-step2.md)      | Create Step 2 (Samples)            | S07        | `Step2Samples`, `SampleFormCard`, `SectionA/B/C`                                                           |
| [S09](./S09-create-campaign-step3.md)      | Create Step 3 (Review)             | S08        | `Step3Review`, `ReviewSummary`, `VerificationCodeBox`                                                      |
| [S10](./S10-my-campaigns.md)               | MyCampaignsPage                    | S01        | `MyCampaignsPage`, `CampaignListItem`, `EditCampaignSheet`, `DeleteCampaignConfirm`, filters               |
| [S11](./S11-wallet.md)                     | WalletPage                         | —          | `WalletPage`, `BalanceCard`, `DepositSheet`, `WithdrawSheet`, `TransactionList`, `ContributionList`        |
| [S12](./S12-account.md)                    | AccountPage                        | S02        | `AccountPage`, `ProfileSection`, `EmailVerificationSection`, `ChangePasswordForm`, `NotificationPrefsForm` |

---

## `src/routes/index.tsx` — Final Import Map

After all stories are done, routes should import from:

```ts
import HomePage from '../pages/home/HomePage';
import CampaignDetailPage from '../pages/campaign-detail/CampaignDetailPage';
import CreateCampaignPage from '../pages/create-campaign/CreateCampaignPage';
import MyCampaignsPage from '../pages/my-campaigns/MyCampaignsPage';
import WalletPage from '../pages/wallet/WalletPage';
import AccountPage from '../pages/account/AccountPage';
// LoginPage, VerifyEmailPage, OfflinePage — unchanged (simple files)
// UserPage — unchanged or optional rewrite
// admin/ — unchanged (already refactored)
```

Each story agent updates `src/routes/index.tsx` directly for its own import — no shim files ever.
