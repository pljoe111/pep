# S11 — WalletPage Rewrite

**Depends on:** nothing (independent)  
**Unlocks:** nothing downstream

---

## Purpose

Decompose `src/pages/WalletPage.tsx` (332 lines) into a feature folder. Balance, deposit, withdraw, transaction history, and my-contributions list are all currently inline. After this story each concern is its own component.

---

## Update `src/routes/index.tsx`

Change the `WalletPage` import to:

```ts
import WalletPage from '../pages/wallet/WalletPage';
```

---

## Files to Create

```
src/pages/wallet/
├── WalletPage.tsx                 ← NEW (thin orchestrator)
└── components/
    ├── BalanceCard.tsx            ← NEW
    ├── DepositSheet.tsx           ← NEW
    ├── WithdrawSheet.tsx          ← NEW
    ├── TransactionList.tsx        ← NEW
    └── ContributionList.tsx       ← NEW
```

---

## Hooks to Use

All in `src/api/hooks/useWallet.ts` (verify they exist; add if missing):

```ts
useWalletBalance()                           // → { balance: string }  (Decimal as string)
useDepositAddress()                          // → { address: string }
useTransactions(filters: TxFilters)          // → paginated LedgerTransactionDto[]
useMyContributions()                         // → ContributionDto[] for current user
useWithdraw()                                // mutation: POST /wallet/withdraw
```

`TxFilters` is in `src/api/queryKeys.ts`:

```ts
interface TxFilters {
  type?: string;
  page?: number;
}
```

If `useMyContributions` doesn't exist, add it:

```ts
export function useMyContributions() {
  return useQuery({
    queryKey: ['wallet', 'contributions'],
    queryFn: () => walletApi.walletControllerGetMyContributions(),
  });
}
```

---

## 1. `WalletPage.tsx` (orchestrator)

```tsx
const [openSheet, setOpenSheet] = useState<'deposit' | 'withdraw' | null>(null);
const [txPage, setTxPage] = useState(1);
```

**Layout:**

```tsx
<AppShell>
  <PageContainer>
    <h1 className="text-3xl font-bold text-text mb-4">My Wallet</h1>

    <BalanceCard
      onDepositClick={() => setOpenSheet('deposit')}
      onWithdrawClick={() => setOpenSheet('withdraw')}
    />

    {/* Tabs: Transactions | My Contributions */}
    <Tabs ... />

    <DepositSheet isOpen={openSheet === 'deposit'} onClose={() => setOpenSheet(null)} />
    <WithdrawSheet isOpen={openSheet === 'withdraw'} onClose={() => setOpenSheet(null)} />
  </PageContainer>
</AppShell>
```

**Tabs:**

```ts
const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'contributions', label: 'My Contributions' },
];
```

Active tab state: `useState('transactions')`.

---

## 2. `BalanceCard.tsx`

```tsx
interface BalanceCardProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}
```

**Layout:**

```
┌──────────────────────────────────────────────┐
│  Available Balance                           │
│                                              │
│          $   2 4 0 . 0 0                     │
│        (text-4xl font-extrabold text-text)   │
│                                              │
│  [ Deposit ]          [ Withdraw ]           │
└──────────────────────────────────────────────┘
```

- Use `useWalletBalance()` to fetch balance
- Balance display: `formatUSD(parseFloat(balance))` where `formatUSD` is from `src/lib/formatters`
- Loading state: gray skeleton `animate-pulse h-10 w-40 rounded-xl bg-border` where balance would be
- "Deposit" button: `variant="primary" size="md"` with `ArrowDownToLine` icon from lucide-react
- "Withdraw" button: `variant="secondary" size="md"` with `ArrowUpFromLine` icon from lucide-react
- Buttons row: `flex gap-3` (each button `flex-1`)
- Card: `<Card>` component; `className="mb-6"`
- `min-h-[44px]` on both buttons (already enforced by `size="md"`)

---

## 3. `DepositSheet.tsx`

```tsx
interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Deposit USDT"

Your deposit address:

┌──────────────────────────────────────────────┐
│           [QR CODE]                          │
│                                              │
│  8vJh...x9kP  [ Copy address ]              │
└──────────────────────────────────────────────┘

⚠ Only send USDT (SPL token) on the Solana network.
  Sending any other token may result in permanent loss.

"Funds arrive within 2-3 minutes after the on-chain
 transaction is confirmed."
```

- `useDepositAddress()` — fetches the unique deposit address
- QR code: `import { QRCodeSVG } from 'qrcode.react'` (already in package.json) — render `<QRCodeSVG value={address} size={200} />`; center with `flex justify-center`
- Address truncation: show first 4 + last 4 chars: `${address.slice(0, 4)}...${address.slice(-4)}`; alongside it show the full address in a `<code className="text-xs text-text-2 break-all">` block
- Copy button: `Button variant="secondary" size="sm"` with `Copy` icon; `navigator.clipboard.writeText(address)`; 2-second "Copied!" feedback
- Warning box: `bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800` with `AlertTriangle` icon

---

## 4. `WithdrawSheet.tsx`

```tsx
interface WithdrawSheetProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Layout:**

```
Sheet title: "Withdraw USDT"

Available: $240.00

Destination Solana address:
[ Input — validate: 32–44 alphanumeric chars (Solana pubkey format) ]

Amount (USD):
[ $ input ] [ MAX ]

Minimum withdrawal: $10.00

[ Review Withdrawal → ]
```

**On click "Review Withdrawal"** (validate first, then show confirmation step inline):

```
────── Review ──────

Send:       $100.00
To:         8vJh...x9kP

[ Confirm Withdrawal ]   [ ← Edit ]
```

**Behaviour:**

- Balance from `useWalletBalance()`
- "MAX" button: sets amount to balance value
- Address validation: use `isValidSolanaAddress` from `src/lib/validators.ts` (add if missing — Solana addresses are base58, 32–44 chars). Simple check: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)`
- Amount validation: > 0, ≤ balance, ≥ minimum (fetch minimum from `useAppInfo()` or use hardcoded `10` if not available via API)
- Two-step UX: `useState<'input' | 'confirm'>('input')`; "Review" button advances to confirm; "← Edit" goes back
- Confirm step sends `useWithdraw({ address, amount })` mutation
- On success: toast `"Withdrawal submitted. Funds will arrive within a few minutes."` + invalidate wallet balance + `onClose()`
- On error: toast with server error message; return to `input` step

---

## 5. `TransactionList.tsx`

```tsx
interface TransactionListProps {
  page: number;
  onPageChange: (page: number) => void;
}
```

**Uses:** `useTransactions({ page })` paginated query.

**Each transaction row:**

```
┌─────────────────────────────────────────────────┐
│  ↓ Deposit           + $100.00   Jan 15, 2025  │
│  ↑ Contribution to BPC-157...  − $50.00        │
│    [status badge]                               │
└─────────────────────────────────────────────────┘
```

- Direction icon: `ArrowDownToLine` for inflows (Deposit, Refund, Payout) in `text-success`; `ArrowUpFromLine` for outflows (Withdrawal, Contribution) in `text-danger`
- Type label: human-readable; derive from `tx.type` field
  - `'deposit'` → "Deposit"
  - `'withdrawal'` → "Withdrawal"
  - `'contribution'` → "Contribution" (if `tx.relatedCampaignTitle`, append `" to {title}"` truncated to 30 chars)
  - `'refund'` → "Refund"
  - `'payout'` → "Payout"
- Amount: `text-sm font-semibold`; positive amounts `text-success`, negative `text-danger`
- Status badge: render if `tx.status !== 'completed'`:
  - `'pending'` → amber `Badge`
  - `'failed'` → red `Badge`
- Date: `text-xs text-text-3`, use `formatDate` from formatters
- Linked campaigns: if `tx.relatedCampaignId`, wrap the campaign title in a `Link` to `/campaigns/:id`

**Pagination:** use simple Previous / Next buttons below the list:

```tsx
<div className="flex justify-between mt-4">
  <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
    ← Previous
  </Button>
  <span className="text-sm text-text-3 self-center">Page {page}</span>
  <Button variant="ghost" size="sm" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
    Next →
  </Button>
</div>
```

**Empty state:** `EmptyState` with message "No transactions yet" + action "Make a deposit" → calls `onDepositClick` (thread this prop up to the orchestrator if needed).

---

## 6. `ContributionList.tsx`

```tsx
// No props — reads from useMyContributions()
```

**Uses:** `useMyContributions()` — full list (not paginated; contributions are bounded in number).

**Each row:**

```
Campaign Title (linked)          Jan 15, 2025
[STATUS BADGE]       Contributed: $50.00  (refunded: gray + strikethrough)
████████████░░░   73% funded
```

- Campaign title: `text-sm font-medium text-text` — `Link` to `/campaigns/:id`
- Status badge: `CampaignStatusBadge` from S01
- Contribution amount: `text-sm text-text-2`; if `contribution.status === 'refunded'`: `line-through text-text-3` + append `" (refunded)"`
- Progress bar: `ProgressBar` from `src/components/ui/ProgressBar`

**Empty state:** `EmptyState` with "No contributions yet. Explore campaigns to back."

---

## Acceptance Criteria

- [ ] `BalanceCard` shows live balance from API; skeleton while loading
- [ ] Deposit button opens `DepositSheet`; QR code renders; address copy works with feedback
- [ ] Withdraw button opens `WithdrawSheet`
- [ ] Withdraw sheet: address validation rejects invalid Solana pubkeys
- [ ] Withdraw sheet: amount ≤ balance enforced; MAX button fills balance
- [ ] Withdraw sheet two-step flow: Review → Confirm; Edit returns to input
- [ ] On successful withdrawal: sheet closes, balance refreshes, success toast shown
- [ ] Transaction list paginates via Previous / Next buttons
- [ ] Transaction rows show correct direction icons, human labels, linked campaign titles
- [ ] Contribution list shows campaign status badge, amount, progress bar
- [ ] Contributions are struck through when refunded
- [ ] Empty states render correctly for both lists
- [ ] Zero TypeScript errors, no hardcoded hex
