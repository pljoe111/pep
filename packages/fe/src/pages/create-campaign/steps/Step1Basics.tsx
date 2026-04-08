import { WizardFormState } from '../types';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { formatUSD } from '../../../lib/formatters';
import { AlertTriangle } from 'lucide-react';

interface Step1BasicsProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onNext: () => void;
}

export const Step1Basics = ({
  formState,
  estimatedLabCost,
  onUpdate,
  onNext,
}: Step1BasicsProps) => {
  const platformFee = 5; // Default platform fee

  const { title, description, amountRequested, fundingThresholdPercent } = formState;

  const numericAmount = parseFloat(amountRequested) || 0;
  const isHighMultiplier = estimatedLabCost > 0 && numericAmount > estimatedLabCost * 1.5;

  const isValid = title.trim().length > 0 && description.trim().length > 0 && numericAmount > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-1">
          <Input
            label="Campaign Title"
            placeholder="e.g. Test My BPC-157 Capsules"
            value={title}
            onChange={(e) => onUpdate({ title: e.target.value.slice(0, 200) })}
            required
          />
          <div className="flex justify-end">
            <span className="text-xs text-text-3">{title.length}/200</span>
          </div>
        </div>

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Describe the product, why you want it tested, and what you hope to find out."
          value={description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={4}
          required
        />

        {/* Amount Requested */}
        <div className="space-y-3">
          <Input
            label="Amount Requested (USD)"
            type="number"
            placeholder="0.00"
            value={amountRequested}
            onChange={(e) => onUpdate({ amountRequested: e.target.value })}
            min="1"
            step="0.01"
            required
            helperText={`Estimated lab cost: ${formatUSD(estimatedLabCost)}`}
          />

          {isHighMultiplier && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-bold">High funding goal</p>
                <p>
                  Your ask is {(numericAmount / estimatedLabCost).toFixed(1)}× your estimated lab
                  costs. Consider reducing it or explaining the gap in your description.
                </p>
                <p className="text-xs opacity-80 italic">
                  Note: Goals exceeding 1.5× lab costs require admin approval before publishing.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-text-3 px-1">Platform keeps {platformFee}% on resolution.</p>
        </div>

        {/* Funding Threshold */}
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-end">
            <label className="text-sm font-medium text-text">
              Lock campaign when {fundingThresholdPercent}% funded
            </label>
            <span className="text-xl font-bold text-primary">{fundingThresholdPercent}%</span>
          </div>

          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={fundingThresholdPercent}
            onChange={(e) => onUpdate({ fundingThresholdPercent: parseInt(e.target.value) })}
            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
          />

          <p className="text-xs text-text-2 leading-relaxed">
            You can only ship samples once you lock. Locking closes new contributions.
          </p>
        </div>
      </div>

      <Button variant="primary" fullWidth size="lg" disabled={!isValid} onClick={onNext}>
        Next: Add Samples →
      </Button>
    </div>
  );
};
