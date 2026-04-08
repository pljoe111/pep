import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTransactions } from '../../../api/hooks/useWallet';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatUSD, formatDate } from '../../../lib/formatters';

interface TransactionListProps {
  page: number;
  onPageChange: (page: number) => void;
  onDepositClick: () => void;
}

export function TransactionList({ page, onPageChange, onDepositClick }: TransactionListProps) {
  const { data, isLoading } = useTransactions({ page });
  const transactions = data?.data || [];
  const total = data?.total || 0;
  const limit = data?.limit || 20;
  const hasNextPage = page * limit < total;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        heading="No transactions yet"
        subtext="Your transaction history will appear here once you make a deposit or contribution."
        ctaLabel="Make a deposit"
        onCta={onDepositClick}
      />
    );
  }

  const getTxLabel = (tx: any) => {
    switch (tx.transaction_type) {
      case 'deposit':
        return 'Deposit';
      case 'withdrawal':
        return 'Withdrawal';
      case 'contribution':
        return (
          <span>
            Contribution to{' '}
            {tx.reference_id ? (
              <Link
                to={`/campaigns/${tx.to_account_id}`}
                className="text-primary hover:underline font-medium"
              >
                {tx.related_campaign_title || 'Campaign'}
              </Link>
            ) : (
              'Campaign'
            )}
          </span>
        );
      case 'refund':
        return 'Refund';
      case 'payout':
        return 'Payout';
      default:
        return tx.transaction_type;
    }
  };

  const isPositive = (type: string) => ['deposit', 'refund', 'payout'].includes(type);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border">
        {transactions.map((tx) => (
          <div key={tx.id} className="py-4 flex items-start gap-4">
            <div
              className={`p-2 rounded-full shrink-0 ${
                isPositive(tx.transaction_type)
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {isPositive(tx.transaction_type) ? (
                <ArrowDownToLine size={20} />
              ) : (
                <ArrowUpFromLine size={20} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm font-semibold text-text truncate pr-2">
                  {getTxLabel(tx)}
                </div>
                <div
                  className={`text-sm font-bold whitespace-nowrap ${
                    isPositive(tx.transaction_type) ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isPositive(tx.transaction_type) ? '+' : '−'} {formatUSD(Number(tx.amount))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-text-3">{formatDate(tx.created_at)}</span>
                {tx.status !== 'completed' && (
                  <Badge variant={tx.status === 'pending' ? 'amber' : 'red'} size="sm">
                    {tx.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Previous
        </Button>
        <span className="text-sm text-text-3 font-medium">Page {page}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
