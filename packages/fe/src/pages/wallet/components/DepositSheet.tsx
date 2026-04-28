import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { NetworkSolana, TokenPYUSD, TokenUSDC, TokenUSDT } from '@web3icons/react';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { useDepositAddress } from '../../../api/hooks/useWallet';
import { Spinner } from '../../../components/ui/Spinner';
import { DepositDisclosureOverlay } from '../../../components/ui/DepositDisclosureOverlay';
import { useDepositDisclosure } from '../../../hooks/useDepositDisclosure';
import { useTimezoneSync } from '../../../hooks/useTimezoneSync';

interface DepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositSheet({ isOpen, onClose }: DepositSheetProps) {
  const { data, isLoading } = useDepositAddress();
  const [copied, setCopied] = useState(false);
  const address = data?.address ?? '';

  const { shouldShow, doNotShowAgain, setDoNotShowAgain, accept } = useDepositDisclosure();

  // Background timezone sync — runs once on mount, silently no-ops on error
  useTimezoneSync();

  const handleCopy = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Deposit">
      <div className="relative">
        <div className="space-y-5">
          {/* Accepted tokens strip — amber header style matching disclosure overlay */}
          <div className="rounded-2xl overflow-hidden border border-amber-200">
            {/* Amber header band */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-400">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Accepted tokens · Solana network only
              </p>
              <NetworkSolana size={20} variant="branded" className="flex-shrink-0" />
            </div>

            {/* Token row */}
            <div className="flex items-center gap-5 px-4 py-3 bg-amber-50">
              {(
                [
                  { Icon: TokenUSDC, label: 'USDC' },
                  { Icon: TokenUSDT, label: 'USDT' },
                  { Icon: TokenPYUSD, label: 'PYUSD' },
                ] as const
              ).map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={24} variant="branded" />
                  <span className="text-sm font-semibold text-amber-900">{label}</span>
                </div>
              ))}
            </div>

            {/* Danger note */}
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong className="text-danger">Do not send any other token or network.</strong>{' '}
                Funds sent from unsupported chains or mints will be lost permanently.
              </p>
            </div>
          </div>

          {/* QR + address */}
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

          {/* Conversion note */}
          <div className="bg-surface-a border border-border rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-text">Conversion info</p>
            <p className="text-xs text-text-2 leading-relaxed">
              USDT is credited 1&nbsp;:&nbsp;1 with no fee. USDC and PYUSD are instantly swapped to
              USDT via Jupiter — depositing $100 USDC may credit you ~$99.90–$99.95 USDT depending
              on on-chain liquidity and the conversion fee.
            </p>
          </div>

          <p className="text-xs text-text-3 text-center leading-relaxed">
            Funds arrive within 2–3 minutes after the on-chain transaction is confirmed.
          </p>

          <Button variant="secondary" fullWidth size="lg" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Disclosure overlay — rendered on top of content when shouldShow is true */}
        {shouldShow && (
          <DepositDisclosureOverlay
            doNotShowAgain={doNotShowAgain}
            onDoNotShowAgainChange={setDoNotShowAgain}
            onAccept={accept}
          />
        )}
      </div>
    </Sheet>
  );
}
