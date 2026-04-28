import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useWalletBalance, useWithdraw } from '../../../api/hooks/useWallet';
import { formatUSD, truncateAddress } from '../../../lib/formatters';
import { isValidSolanaAddress } from '../../../lib/validators';
import { useToast } from '../../../hooks/useToast';

interface WithdrawSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawSheet({ isOpen, onClose }: WithdrawSheetProps) {
  const { success, error: toastError } = useToast();
  const { data: balanceData } = useWalletBalance();
  const withdrawMutation = useWithdraw();

  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ address?: string; amount?: string }>({});

  const balance =
    typeof balanceData?.balance === 'number'
      ? balanceData.balance
      : parseFloat(balanceData?.balance ?? '0');
  const minWithdrawal = 10;

  const validate = () => {
    const newErrors: { address?: string; amount?: string } = {};
    if (!isValidSolanaAddress(address)) {
      newErrors.address = 'Invalid Solana address';
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Enter a valid amount';
    } else if (amountNum < minWithdrawal) {
      newErrors.amount = `Minimum withdrawal is ${formatUSD(minWithdrawal)}`;
    } else if (amountNum > balance) {
      newErrors.amount = 'Insufficient balance';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReview = () => {
    if (validate()) {
      setStep('confirm');
    }
  };

  const handleConfirm = () => {
    withdrawMutation.mutate(
      { destination_address: address, amount: parseFloat(amount) },
      {
        onSuccess: () => {
          success('Withdrawal submitted. Funds will arrive within a few minutes.');
          onClose();
          setStep('input');
          setAddress('');
          setAmount('');
        },
        onError: (err: unknown) => {
          const apiErr = err as { response?: { data?: { message?: string } } };
          toastError(apiErr.response?.data?.message ?? 'Withdrawal failed');
          setStep('input');
        },
      }
    );
  };

  const handleMax = () => {
    setAmount(balance.toString());
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Withdraw USDT">
      <div className="space-y-6">
        {step === 'input' ? (
          <>
            <div className="p-4 bg-surface-a rounded-xl border border-border flex justify-between items-center">
              <span className="text-sm text-text-2">Available Balance</span>
              <span className="text-lg font-bold text-text">{formatUSD(balance)}</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Destination Solana address</label>
                <Input
                  placeholder="Enter Solana address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  error={errors.address}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-medium text-text">Amount (USD)</label>
                  <button
                    type="button"
                    onClick={handleMax}
                    className="text-xs font-bold text-primary hover:text-primary-d"
                  >
                    MAX
                  </button>
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={errors.amount}
                  prefix="$"
                />
                <p className="text-xs text-text-3">
                  Minimum withdrawal: {formatUSD(minWithdrawal)}
                </p>
              </div>
            </div>

            <Button variant="primary" fullWidth size="lg" onClick={handleReview}>
              Review Withdrawal <ArrowRight size={18} className="ml-2" />
            </Button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-l text-primary mb-2">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-text">Review Withdrawal</h3>
              <p className="text-sm text-text-2">Please confirm the details below</p>
            </div>

            <div className="space-y-3 p-4 bg-surface-a rounded-xl border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-2">Send</span>
                <span className="font-bold text-text">{formatUSD(parseFloat(amount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-2">To</span>
                <span className="font-mono text-text">{truncateAddress(address)}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between text-sm">
                <span className="text-text-2">Network</span>
                <span className="text-text font-medium">Solana</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={() => setStep('input')}
                disabled={withdrawMutation.isPending}
              >
                <ArrowLeft size={18} className="mr-2" /> Edit
              </Button>
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleConfirm}
                loading={withdrawMutation.isPending}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
