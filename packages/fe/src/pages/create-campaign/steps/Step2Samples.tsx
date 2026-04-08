import { useEffect, useMemo } from 'react';
import { useAppInfo } from '../../../api/hooks/useAppInfo';
import { WizardFormState, SampleForm } from '../types';
import { SampleFormCard } from '../components/SampleFormCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Slider } from '../../../components/ui/Slider';
import { formatUSD } from '../../../lib/formatters';
import { Plus, Info } from 'lucide-react';

interface Step2SamplesProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onEstimatedCostChange: (cost: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2Samples = ({
  formState,
  estimatedLabCost,
  onUpdate,
  onEstimatedCostChange,
  onNext,
  onBack,
}: Step2SamplesProps) => {
  const { data: appInfo } = useAppInfo();
  const platformFeePercent = appInfo?.platform_fee_percent ?? 5;
  const maxMultiplier = appInfo?.max_campaign_multiplier ?? 3;

  // Add initial sample if empty
  useEffect(() => {
    if (formState.samples.length === 0) {
      addSample();
    }
  }, []);

  // Compute estimated cost whenever samples or test catalog changes
  const totalCost = useMemo(() => {
    return formState.samples.reduce((sum, s) => sum + (s.cost || 0), 0);
  }, [formState.samples]);

  useEffect(() => {
    onEstimatedCostChange(totalCost);
  }, [totalCost, onEstimatedCostChange]);

  // Default amount requested to 50% of estimated lab cost if not set
  // Only runs when amountRequested is empty to allow user to set 0
  useEffect(() => {
    if (estimatedLabCost > 0 && formState.amountRequested === '') {
      onUpdate({ amountRequested: (estimatedLabCost * 0.5).toFixed(2) });
    }
  }, [estimatedLabCost, formState.amountRequested, onUpdate]);

  const addSample = () => {
    const newSample: SampleForm = {
      id: crypto.randomUUID(),
      peptideId: '',
      peptideName: '',
      vendorId: '',
      vendorName: '',
      purchaseDate: '',
      physicalDescription: '',
      label: '',
      targetLabId: '',
      targetLabName: '',
      selectedTestIds: [],
      claims: [],
      cost: 0,
    };
    onUpdate({ samples: [...formState.samples, newSample] });
  };

  const removeSample = (id: string) => {
    onUpdate({ samples: formState.samples.filter((s) => s.id !== id) });
  };

  const updateSample = (id: string, patch: Partial<SampleForm>) => {
    onUpdate({
      samples: formState.samples.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const uniqueLabIds = [...new Set(formState.samples.map((s) => s.targetLabId).filter(Boolean))];
  const hasMultipleLabs = uniqueLabIds.length > 1;

  const isAllComplete = formState.samples.every(
    (s) =>
      s.peptideId &&
      s.vendorId &&
      s.purchaseDate &&
      s.label &&
      s.targetLabId &&
      s.selectedTestIds.length > 0
  );

  const canAddMore = formState.samples.length > 0 && formState.samples[0].peptideId;

  const numericAmount = parseFloat(formState.amountRequested) || 0;

  const isStepValid =
    isAllComplete && numericAmount >= 0 && formState.amountRequested.trim() !== '';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        {formState.samples.map((sample, index) => (
          <SampleFormCard
            key={sample.id}
            sample={sample}
            index={index + 1}
            onUpdate={(patch) => updateSample(sample.id, patch)}
            onRemove={() => removeSample(sample.id)}
            canRemove={formState.samples.length > 1}
          />
        ))}

        {canAddMore && (
          <Button
            variant="secondary"
            fullWidth
            onClick={addSample}
            className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary-l/10 py-6"
          >
            <Plus size={20} />
            Add Another Sample
          </Button>
        )}

        {hasMultipleLabs && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3">
            <Info size={18} className="text-info shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              Your samples are going to different labs. Consider creating separate campaigns for
              cleaner tracking.
            </p>
          </div>
        )}
      </div>

      {/* Funding Goal Section */}
      <div className="pt-8 border-t border-border space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-text">Finalize Funding Goal</h3>
          <p className="text-sm text-text-2">
            Based on your selected tests, set the total amount you need to raise.
          </p>
        </div>

        <div className="space-y-6">
          {/* Amount Requested */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                label="Amount Requested (USD)"
                type="number"
                placeholder="0.00"
                value={formState.amountRequested}
                onChange={(e) => onUpdate({ amountRequested: e.target.value })}
                min="0"
                step="0.01"
                required
                helperText={`Estimated lab cost: ${formatUSD(estimatedLabCost)}`}
              />

              {estimatedLabCost > 0 && (
                <div className="px-1 pt-1">
                  <Slider
                    min={0}
                    max={estimatedLabCost * maxMultiplier}
                    step={1}
                    value={numericAmount}
                    onChange={(val) => onUpdate({ amountRequested: val.toString() })}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-text-3 uppercase font-bold">Min: $0.00</span>
                    <span className="text-[10px] text-text-3 uppercase font-bold">
                      Max: {formatUSD(estimatedLabCost * maxMultiplier)} ({maxMultiplier}x)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-text-3 px-1">
              Platform keeps {platformFeePercent}% on resolution.
            </p>
          </div>

          {/* Funding Threshold */}
          <div className="space-y-4 pt-2">
            <Slider
              label={`Lock campaign when ${formState.fundingThresholdPercent}% funded`}
              min={5}
              max={100}
              step={5}
              value={formState.fundingThresholdPercent}
              onChange={(val) => onUpdate({ fundingThresholdPercent: val })}
              showValue
              valueFormatter={(v) => `${v}%`}
              helperText="You can only ship samples once you lock. Locking closes new contributions."
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Button variant="primary" fullWidth size="lg" disabled={!isStepValid} onClick={onNext}>
          Next: Review →
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack}>
          ← Back to Basics
        </Button>
      </div>
    </div>
  );
};
