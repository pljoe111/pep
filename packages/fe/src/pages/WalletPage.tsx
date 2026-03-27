import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { Select } from '../components/ui/Select';
import {
  useWalletBalance,
  useDepositAddress,
  useTransactions,
  useWithdraw,
} from '../api/hooks/useWallet';
import { formatUSD, formatCrypto, formatDate, truncateAddress } from '../lib/formatters';
import { isValidSolanaAddress } from '../lib/validators';
import type { LedgerTransactionDto, TransactionType, TxStatus } from 'api-client';

const TX_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdrawal', label: 'Withdrawals' },
  { value: 'contribution', label: 'Contributions' },
  { value: 'refund', label: 'Refunds' },
  { value: 'payout', label: 'Payouts' },
  { value: 'fee', label: 'Fees' },
];

interface WithdrawForm {
  amount: string;
  currency: 'usdc' | 'usdt';
  destination_address: string;
}

function txTypeColor(type: TransactionType): 'green' | 'amber' | 'gray' | 'blue' | 'red' {
  const map: Record<TransactionType, 'green' | 'amber' | 'gray' | 'blue' | 'red'> = {
    deposit: 'green',
    withdrawal: 'amber',
    contribution: 'blue',
    refund: 'green',
    payout: 'green',
    fee: 'gray',
  };
  return map[type] ?? 'gray';
}

function txStatusColor(status: TxStatus): 'green' | 'amber' | 'gray' | 'red' {
  const map: Record<TxStatus, 'green' | 'amber' | 'gray' | 'red'> = {
    completed: 'green',
    pending: 'amber',
    confirmed: 'green',
    failed: 'red',
  };
  return map[status] ?? 'gray';
}

function TransactionRow({ tx }: { tx: LedgerTransactionDto }): React.ReactElement {
  const isPending = tx.status === 'pending';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant={
              txTypeColor(tx.transaction_type) === 'green'
                ? 'green'
                : txTypeColor(tx.transaction_type) === 'amber'
                  ? 'amber'
                  : txTypeColor(tx.transaction_type) === 'blue'
                    ? 'blue'
                    : txTypeColor(tx.transaction_type) === 'red'
                      ? 'red'
                      : 'gray'
            }
          >
            {tx.transaction_type}
          </Badge>
          <Badge
            variant={
              txStatusColor(tx.status) === 'green'
                ? 'green'
                : txStatusColor(tx.status) === 'amber'
                  ? 'amber'
                  : txStatusColor(tx.status) === 'red'
                    ? 'red'
                    : 'gray'
            }
          >
            {isPending && <Spinner size="sm" color="primary" className="mr-1 inline-block" />}
            {tx.status}
          </Badge>
        </div>
        <p className="text-xs text-text-3">{formatDate(tx.created_at)}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-base text-text">
          {formatCrypto(tx.amount, tx.currency as 'usdc' | 'usdt')}
        </p>
        <p className="text-xs text-text-3">{formatUSD(tx.amount)}</p>
      </div>
    </div>
  );
}

export function WalletPage(): React.ReactElement {
  const toast = useToast();
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const txPage = 1;
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: balance, isLoading: balanceLoading } = useWalletBalance();
  const { data: depositAddress, isLoading: depositLoading } = useDepositAddress();
  const { data: transactions, isLoading: txLoading } = useTransactions({
    type: txTypeFilter || undefined,
    page: txPage,
  });
  const { mutateAsync: withdraw, isPending: withdrawPending } = useWithdraw();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WithdrawForm>({
    defaultValues: { amount: '', currency: 'usdc', destination_address: '' },
  });

  const onWithdraw = handleSubmit(async (data) => {
    if (!isValidSolanaAddress(data.destination_address)) {
      toast.error('Invalid Solana address');
      return;
    }
    try {
      await withdraw({
        amount: parseFloat(data.amount),
        currency: data.currency,
        destination_address: data.destination_address,
      });
      toast.success('Withdrawal submitted — processing...');
      setShowWithdraw(false);
      reset();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Withdrawal failed');
    }
  });

  return (
    <AppShell>
      <PageContainer className="py-4">
        <h1 className="text-2xl font-bold text-text mb-6">Wallet</h1>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {balanceLoading ? (
            <>
              <div className="h-24 bg-stone-200 rounded-2xl animate-pulse" />
              <div className="h-24 bg-stone-200 rounded-2xl animate-pulse" />
            </>
          ) : (
            <>
              <Card padding="md" className="bg-gradient-to-br from-teal-500 to-teal-700 border-0">
                <p className="text-xs text-teal-100 font-medium mb-1">USDC</p>
                <p className="text-2xl font-extrabold text-white">
                  {formatUSD(balance?.balance_usdc ?? 0)}
                </p>
              </Card>
              <Card padding="md" className="bg-gradient-to-br from-blue-500 to-blue-700 border-0">
                <p className="text-xs text-blue-100 font-medium mb-1">USDT</p>
                <p className="text-2xl font-extrabold text-white">
                  {formatUSD(balance?.balance_usdt ?? 0)}
                </p>
              </Card>
            </>
          )}
        </div>

        {/* Deposit section */}
        <Card padding="lg" className="mb-4">
          <h2 className="text-lg font-bold text-text mb-3">Deposit</h2>
          {depositLoading && <Spinner />}
          {depositAddress && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-xl border border-border">
                <QRCodeSVG value={depositAddress.qr_hint} size={160} />
              </div>
              <div className="w-full">
                <p className="text-xs text-text-2 mb-1 font-medium">Your Solana deposit address:</p>
                <div className="flex items-center gap-2 bg-surface-a border border-border rounded-xl px-3 py-2">
                  <code className="text-xs text-text flex-1 break-all font-mono">
                    {depositAddress.address}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(depositAddress.address);
                      toast.info('Address copied!');
                    }}
                    className="text-primary text-xs font-medium shrink-0 min-h-[44px] px-2"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-text-3 mt-2 text-center">
                  Send USDC or USDT to this address on Solana.
                  <br />
                  {truncateAddress(depositAddress.address)}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Withdraw section */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text">Withdraw</h2>
            {!showWithdraw && (
              <Button variant="secondary" size="sm" onClick={() => setShowWithdraw(true)}>
                New Withdrawal
              </Button>
            )}
          </div>
          {showWithdraw && (
            <form onSubmit={(e) => void onWithdraw(e)} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text block mb-1">Currency</label>
                <div className="flex gap-2">
                  {(['usdc', 'usdt'] as const).map((c) => (
                    <label
                      key={c}
                      className="flex-1 flex items-center justify-center py-3 rounded-xl border-2 text-sm font-semibold cursor-pointer min-h-[44px] transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-l has-[:checked]:text-primary border-border text-text-2"
                    >
                      <input type="radio" value={c} className="sr-only" {...register('currency')} />
                      {c.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="withdraw-amount"
                  className="text-sm font-medium text-text block mb-1"
                >
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-2">$</span>
                  <input
                    id="withdraw-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="5"
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border pl-8 pr-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    {...register('amount', {
                      required: 'Amount required',
                      min: { value: 5, message: 'Minimum $5' },
                    })}
                  />
                </div>
                {errors.amount && (
                  <p className="text-sm text-danger mt-1">{errors.amount.message}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="withdraw-address"
                  className="text-sm font-medium text-text block mb-1"
                >
                  Destination Solana Address
                </label>
                <input
                  id="withdraw-address"
                  type="text"
                  inputMode="none"
                  placeholder="Enter Solana address"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] font-mono text-sm"
                  {...register('destination_address', { required: 'Address required' })}
                />
                {errors.destination_address && (
                  <p className="text-sm text-danger mt-1">{errors.destination_address.message}</p>
                )}
              </div>
              <p className="text-xs text-text-2">Minimum withdrawal: $5.00</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setShowWithdraw(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={withdrawPending}
                >
                  Submit
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Transaction history */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text">Transactions</h2>
            <Select
              options={TX_TYPE_OPTIONS}
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="w-36"
            />
          </div>
          {txLoading && <Spinner />}
          {!txLoading && (transactions?.data ?? []).length === 0 && (
            <EmptyState
              heading="No transactions"
              subtext="Your transaction history will appear here"
            />
          )}
          {(transactions?.data ?? []).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </Card>
      </PageContainer>
    </AppShell>
  );
}
