import { useEffect } from 'react';
import { useTestClaimTemplates } from '../../../api/hooks/useLabs';
import { SampleForm, ClaimForm } from '../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Plus, Minus, Info } from 'lucide-react';

interface SectionCProps {
  sample: SampleForm;
  selectedTestIds: string[];
  onChange: (patch: Partial<SampleForm>) => void;
}

export const SectionC = ({ sample, selectedTestIds, onChange }: SectionCProps) => {
  // This is a simplified version. In a real app, we'd need to fetch templates for ALL selected tests
  // and merge them. For now, we'll focus on the first test or a combined approach.
  const { data: templates = [] } = useTestClaimTemplates(selectedTestIds[0] || '');

  useEffect(() => {
    if (templates.length > 0) {
      const existingClaimTypeIds = new Set(sample.claims.map((c) => `${c.testId}-${c.type}`));

      const newClaims: ClaimForm[] = [...sample.claims];
      let changed = false;

      templates.forEach((t) => {
        const key = `${t.test_id}-${t.claim_kind}`;
        if (!existingClaimTypeIds.has(key)) {
          newClaims.push({
            id: crypto.randomUUID(),
            testId: t.test_id,
            type: t.claim_kind,
            label: t.label,
            value: '',
            required: t.is_required,
          });
          changed = true;
        }
      });

      if (changed) {
        onChange({ claims: newClaims });
      }
    }
  }, [templates, selectedTestIds, sample.claims, onChange]);

  const updateClaim = (id: string, value: string) => {
    const next = sample.claims.map((c) => (c.id === id ? { ...c, value } : c));
    onChange({ claims: next });
  };

  const removeClaim = (id: string) => {
    const next = sample.claims.filter((c) => c.id !== id);
    onChange({ claims: next });
  };

  const addCustomClaim = () => {
    const next: ClaimForm[] = [
      ...sample.claims,
      {
        id: crypto.randomUUID(),
        testId: null,
        type: 'text',
        label: '',
        value: '',
        required: false,
      },
    ];
    onChange({ claims: next });
  };

  const updateCustomLabel = (id: string, label: string) => {
    const next = sample.claims.map((c) => (c.id === id ? { ...c, label } : c));
    onChange({ claims: next });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {sample.claims.map((claim) => (
          <div
            key={claim.id}
            className="flex items-end gap-3 animate-in fade-in slide-in-from-left-2 duration-200"
          >
            <div className="flex-1 space-y-1">
              {claim.testId === null ? (
                <Input
                  label="Claim Label"
                  placeholder="e.g. Purity"
                  value={claim.label}
                  onChange={(e) => updateCustomLabel(claim.id, e.target.value)}
                />
              ) : (
                <label className="text-sm font-medium text-text block mb-1">
                  {claim.label} {claim.required && <span className="text-danger">*</span>}
                </label>
              )}

              {claim.type === 'boolean' ? (
                <Select
                  value={claim.value}
                  onChange={(e) => updateClaim(claim.id, e.target.value)}
                  options={[
                    { value: '', label: 'Select...' },
                    { value: 'true', label: 'Pass' },
                    { value: 'false', label: 'Fail' },
                  ]}
                />
              ) : (
                <div className="relative">
                  <Input
                    type={claim.type === 'number' || claim.type === 'purity' ? 'number' : 'text'}
                    placeholder={claim.type === 'purity' ? '99.9' : 'Enter value...'}
                    value={claim.value}
                    onChange={(e) => updateClaim(claim.id, e.target.value)}
                    className={claim.type === 'purity' ? 'pr-8' : ''}
                  />
                  {claim.type === 'purity' && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-3 font-bold">
                      %
                    </span>
                  )}
                </div>
              )}
            </div>

            {!claim.required && (
              <button
                onClick={() => removeClaim(claim.id)}
                className="p-3 text-text-3 hover:text-danger transition-colors mb-0.5"
                aria-label="Remove claim"
              >
                <Minus size={20} />
              </button>
            )}
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addCustomClaim}
          className="w-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary-l/10"
        >
          <Plus size={16} />
          Add Custom Claim
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          Claims are for contributor context only. The COA is the source of truth.
        </p>
      </div>
    </div>
  );
};
