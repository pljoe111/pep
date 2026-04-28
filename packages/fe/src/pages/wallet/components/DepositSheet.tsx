import { useState } from 'react';
import { Copy, Check, AlertTriangle, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { useDepositAddress } from '../../../api/hooks/useWallet';
import { useAppInfo } from '../../../api/hooks/useAppInfo';
import { Spinner } from '../../../components/ui/Spinner';

interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositSheet({ isOpen, onClose }: DepositSheetProps) {
  const { data, isLoading } = useDepositAddress();
  const { data: appInfo } = useAppInfo();
  const [copied, setCopied] = useState(false);
  const address = data?.address ?? '';

  const handleCopy = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format conversion fee percentage for display (e.g. 50 bps → "0.5")
  const feePercent =
    appInfo?.deposit_conversion_fee_bps != null
      ? (appInfo.deposit_conversion_fee_bps / 100).toFixed(1)
      : '0.5';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Deposit">
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-text-2">Your deposit address (Solana):</p>

          <div className="flex justify-center p-4 bg-white rounded-2xl border border-border">
            {isLoading ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <QRCodeSVG value={address} size={200} />
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-a rounded-xl border border-border w-full">
              <code className="text-xs text-text-2 break-all flex-1 text-left">{address}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Conversion fee disclosure */}
        <div className="bg-[var(--color-surface-a)] border border-border rounded-xl p-4 flex gap-3">
          <Info className="text-[var(--color-primary)] shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text">Accepted currencies</p>
            <p className="text-xs text-text-2 leading-relaxed">
              Send <strong>USDT</strong>, <strong>USDC</strong>, or <strong>PYUSD</strong> on the
              Solana network. USDT deposits are credited 1:1 with no fee. USDC and PYUSD deposits
              are instantly converted to USDT — a <strong>{feePercent}% conversion fee</strong>{' '}
              applies.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">Important</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Only send supported SPL tokens on the Solana network. Other tokens or networks will
              result in permanent loss.
            </p>
          </div>
        </div>

        <p className="text-xs text-text-3 text-center leading-relaxed">
          Funds arrive within 2–3 minutes after the on-chain transaction is confirmed.
        </p>

        <Button variant="secondary" fullWidth size="lg" onClick={onClose}>
          Close
        </Button>
      </div>
    </Sheet>
  );
}
