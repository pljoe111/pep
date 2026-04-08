import { WizardFormState } from '../types';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';

interface Step1BasicsProps {
  formState: WizardFormState;
  onUpdate: (partial: Partial<WizardFormState>) => void;
  onNext: () => void;
}

export const Step1Basics = ({ formState, onUpdate, onNext }: Step1BasicsProps) => {
  const { title, description } = formState;

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {formState.samples.length > 0 && (
        <div className="bg-primary-l/30 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="text-sm font-bold">
                {formState.samples.reduce((sum, s) => sum + s.selectedTestIds.length, 0)}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">
                Current Lab Estimate
              </p>
              <p className="text-lg font-bold text-text">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  formState.samples.reduce((sum, s) => {
                    // Use actual cost if available, otherwise fallback to $125 per sample
                    return sum + (s.cost || 125);
                  }, 0)
                )}
              </p>
            </div>
          </div>
          <button onClick={onNext} className="text-sm font-semibold text-primary hover:underline">
            View Details
          </button>
        </div>
      )}

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
          rows={6}
          required
        />
      </div>

      <Button variant="primary" fullWidth size="lg" disabled={!isValid} onClick={onNext}>
        Next: Add Samples →
      </Button>
    </div>
  );
};
