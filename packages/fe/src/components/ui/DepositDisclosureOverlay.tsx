import { AlertTriangle } from 'lucide-react';
import { NetworkSolana, TokenPYUSD, TokenUSDC, TokenUSDT } from '@web3icons/react';
import { Button } from './Button';

interface DepositDisclosureOverlayProps {
  doNotShowAgain: boolean;
  onDoNotShowAgainChange: (v: boolean) => void;
  onAccept: () => void;
}

export function DepositDisclosureOverlay({
  doNotShowAgain,
  onDoNotShowAgainChange,
  onAccept,
}: DepositDisclosureOverlayProps) {
  return (
    /* Full-bleed overlay centered over the Sheet content */
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-2xl overflow-hidden px-4">
      {/* Blur backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/50" aria-hidden="true" />

      {/* Card */}
      <div className="relative w-full bg-surface rounded-2xl shadow-2xl overflow-hidden">
        {/* Amber warning header band */}
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-400">
          <AlertTriangle size={22} className="text-amber-900 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-amber-900">Conversion notice</p>
            <p className="text-xs text-amber-800 font-medium">Read before depositing</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Accepted tokens strip */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-3 uppercase tracking-wider">
              Accepted tokens · Solana network only
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {(
                  [
                    { Icon: TokenUSDC, label: 'USDC' },
                    { Icon: TokenUSDT, label: 'USDT' },
                    { Icon: TokenPYUSD, label: 'PYUSD' },
                  ] as const
                ).map(({ Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <Icon size={30} variant="branded" />
                    <span className="text-xs text-text-2 font-medium">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-1 pl-4 border-l border-border">
                <NetworkSolana size={30} variant="branded" />
                <span className="text-xs text-text-2 font-medium">Solana</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-2 leading-relaxed">
            <strong className="text-danger">
              Only the tokens above on the Solana network are accepted.
            </strong>{' '}
            Sending any other token or using a different network will result in permanent loss of
            funds.
          </p>

          <p className="text-sm text-text-2 leading-relaxed">
            USDC and PYUSD deposits are automatically swapped to{' '}
            <strong className="text-text">USDT</strong> at the current market rate via Jupiter.{' '}
            <strong className="text-text">
              For example, depositing $100 USDC may credit you ~$99.90–$99.95 USDT
            </strong>{' '}
            depending on on-chain liquidity and the conversion fee at the time of deposit. USDT
            deposits are credited 1&nbsp;:&nbsp;1 with no conversion or fee.
          </p>

          {/* Do not show again */}
          <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
            <input
              type="checkbox"
              className="w-5 h-5 rounded accent-[var(--color-primary)] cursor-pointer"
              checked={doNotShowAgain}
              onChange={(e) => onDoNotShowAgainChange(e.target.checked)}
            />
            <span className="text-sm text-text-2">Don&apos;t show this again</span>
          </label>

          {/* Accept */}
          <Button variant="primary" fullWidth size="lg" onClick={onAccept}>
            I understand, continue
          </Button>
        </div>
      </div>
    </div>
  );
}
