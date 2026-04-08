import { useEffect } from 'react';
import { WizardFormState, SampleForm } from '../types';
import { SampleFormCard } from '../components/SampleFormCard';
import { Button } from '../../../components/ui/Button';
import { Plus, Info } from 'lucide-react';

interface Step2SamplesProps {
  formState: WizardFormState;
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onEstimatedCostChange: (cost: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2Samples = ({
  formState,
  onUpdate,
  onEstimatedCostChange,
  onNext,
  onBack,
}: Step2SamplesProps) => {
  // Add initial sample if empty
  useEffect(() => {
    if (formState.samples.length === 0) {
      addSample();
    }
  }, []);

  // Compute estimated cost whenever samples change
  // Note: In a real app, we'd need the actual test prices which are in SectionB's local query.
  // For this orchestrator, we'll assume Step 2 components might need to bubble this up
  // or we'd fetch all lab tests here. For now, we'll implement a placeholder that S08 can refine.
  useEffect(() => {
    // Placeholder: actual cost calculation happens in SectionB and should be bubbled up
    // or computed here if we had a global tests cache.
    onEstimatedCostChange(0);
  }, [formState.samples, onEstimatedCostChange]);

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

      <div className="flex flex-col gap-3 pt-4">
        <Button variant="primary" fullWidth size="lg" disabled={!isAllComplete} onClick={onNext}>
          Next: Review →
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack}>
          ← Back to Basics
        </Button>
      </div>
    </div>
  );
};
