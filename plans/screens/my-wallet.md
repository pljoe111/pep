# Screen: My Wallet

**Route:** `/wallet`  
**Auth:** Required

---

## Purpose

The user's financial hub. Shows their current spendable balance, lets them deposit and withdraw, and gives a full history of every money movement on their account.

---

## What the Screen Shows

### Balance

The user's current available balance in USD. This is the unified ledger balance — the single number that covers all deposits, contributions, refunds, and payouts.

### Transaction History

A paginated list of every ledger transaction for this account. Each entry shows:

- Transaction type: Deposit, Withdrawal, Contribution, Refund, Payout.
- Amount (positive or negative depending on direction).
- Currency (USDC or USDT, kept for audit purposes).
- Status: Completed, Pending, Failed.
- Date and time.
- For contributions: which campaign it went to (linked).
- For refunds and payouts: which campaign it came from (linked).

### My Contributions

A sub-section (or tab) listing every campaign the user has contributed to. Each entry shows:

- Campaign title (linked to campaign detail).
- Campaign status.
- Amount contributed.
- Contribution date.
- Whether the contribution has been refunded (status indicator).

---

## Actions

### Deposit

Opens a flow (sheet or sub-page) that shows the user's unique Solana deposit address as both a QR code and copyable text. Instructions explain which token to send (USDT, SPL token on Solana network only). No amount is specified — any amount sent to this address is credited automatically once the on-chain transaction is confirmed.

### Withdraw

Opens a flow (sheet or sub-page) with:

- A destination Solana address input (validated as a valid public key format).
- An amount input (must be ≤ available balance; minimum enforced by platform config).
- A summary/confirmation step showing the amount to be deducted before the user commits.

Withdrawal is processed asynchronously. The user is notified (in-app + email) when the on-chain transaction is sent or if it fails.

---

## Notifications Surfaced Here

The following events directly affect the wallet balance and generate notifications:

| Event                       | Effect on Balance                  |
| --------------------------- | ---------------------------------- |
| Deposit confirmed           | Balance increases                  |
| Contribution made           | Balance decreases                  |
| Contribution refunded       | Balance increases                  |
| Campaign resolved (creator) | Balance increases by payout amount |
| Withdrawal sent             | Balance decreases                  |
| Withdrawal failed           | No change (pending reversal shown) |

When any of these notifications arrive, the balance displayed on this screen should reflect the new value without requiring a manual refresh.

---

## Empty States

- No transaction history yet: prompt to make a deposit.
- No contributions yet: shows a note that contributions made on campaigns appear here.
