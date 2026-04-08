import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useWalletBalance } from '../../../api/hooks/useWallet';
import { formatUSD } from '../../../lib/formatters';

interface BalanceCardProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

export function BalanceCard({ onDepositClick, onWithdrawClick }: BalanceCardProps) {
  const { data, isLoading } = useWalletBalance();
  const balance = data?.balance ?? '0';

  return (
    <Card className="mb-6 p-6">
      <div className="flex flex-col items-center text-center space-y-4">
        <span className="text-sm font-medium text-text-2 uppercase tracking-wider">
          Available Balance
        </span>

        {isLoading ? (
          <div className="h-10 w-40 rounded-xl bg-border animate-pulse" />
        ) : (
          <span className="text-4xl font-extrabold text-text">
            {formatUSD(parseFloat(balance))}
          </span>
        )}

        <div className="flex gap-3 w-full mt-4">
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={onDepositClick}
            icon={<ArrowDownToLine size={18} />}
          >
            Deposit
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onWithdrawClick}
            icon={<ArrowUpFromLine size={18} />}
          >
            Withdraw
          </Button>
        </div>
      </div>
    </Card>
  );
}
