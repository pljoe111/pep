import { useState } from 'react';
import { useWalletBalance } from '../../../api/hooks/useWallet';
import { useContribute } from '../../../api/hooks/useCampaigns';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../hooks/useToast';
import { formatUSD } from '../../../lib/formatters';

interface ContributeSheetProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
}

type ContributeCurrency = 'usdc' | 'usdt' | 'pyusd';

const CURRENCY_OPTIONS: { value: ContributeCurrency; label: string; description: string }[] = [
  { value: 'usdt', label: 'USDT', description: 'Tether USD' },
  { value: 'usdc', label: 'USDC', description: 'USD Coin' },
  { value: 'pyusd', label: 'PYUSD', description: 'PayPal USD' },
];

const QUICK_AMOUNTS = [10, 25, 50, 100];

export const ContributeSheet = ({ campaignId, isOpen, onClose }: ContributeSheetProps) => {
  const { data: balanceData } = useWalletBalance();
  const { mutate: contribute, isPending } = useContribute(campaignId);
  const toast = useToast();

  const [amount, setAmount] = useState<string>('');
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<ContributeCurrency>('usdt');

  const balance = balanceData?.balance ?? 0;
  const numericAmount = parseFloat(amount) || 0;
  const isInsufficient = numericAmount > balance;
  const isValid = numericAmount > 0 && !isInsufficient;

  const handleQuickAmountClick = (val: number) => {
    setSelectedQuickAmount(val);
    setAmount(val.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    setSelectedQuickAmount(null);
  };

  const handleSubmit = () => {
    if (!isValid) return;

    contribute(
      { amount: numericAmount, currency },
      {
        onSuccess: () => {
          toast.success('Contribution successful!');
          onClose();
          setAmount('');
          setSelectedQuickAmount(null);
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : 'Failed to contribute';
          toast.error(msg);
        },
      }
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Contribute">
      <div className="space-y-8 pt-2">
        <div className="space-y-1">
          <p className="text-sm text-text-2">Your balance</p>
          <p className="text-3xl font-extrabold text-text">{formatUSD(balance)}</p>
        </div>

        {/* Currency selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-2 uppercase tracking-wide">Currency</p>
          <div className="flex gap-2">
            {CURRENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCurrency(opt.value)}
                className={[
                  'flex-1 min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                  currency === opt.value
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface border-border text-text hover:border-primary/50',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmountClick(val)}
                className={[
                  'flex-1 min-w-[70px] rounded-full border px-4 py-2 text-sm font-semibold transition-all min-h-[44px]',
                  selectedQuickAmount === val
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-surface border-border text-text hover:border-primary/50',
                ].join(' ')}
              >
                ${val}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={handleInputChange}
              min="0.01"
              step="0.01"
              className="text-lg font-bold"
              error={isInsufficient ? 'Insufficient balance' : undefined}
            />
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!isValid}
          loading={isPending}
          onClick={handleSubmit}
        >
          {isInsufficient ? 'Insufficient Balance' : 'Contribute'}
        </Button>
      </div>
    </Sheet>
  );
};
