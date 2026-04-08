import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import axiosInstance from '../../../api/axiosInstance';
import { queryKeys } from '../../../api/queryKeys';
import { SampleForm, ClaimForm } from '../types';
import type { TestClaimTemplateDto } from 'api-client';
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
  // Fetch templates for ALL selected tests
  const results = useQueries({
    queries: selectedTestIds.map((testId) => ({
      queryKey: queryKeys.tests.claimTemplates(testId),
      queryFn: async () => {
        const res = await axiosInstance.get<TestClaimTemplateDto[]>(
          `/tests/${testId}/claim-templates`
        );
        return res.data;
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const allTemplates = results.flatMap((r) => r.data || []);

  useEffect(() => {
    const existingClaimTypeIds = new Set(sample.claims.map((c) => `${c.testId}-${c.type}`));
    let newClaims = [...sample.claims];
    let changed = false;

    if (allTemplates.length > 0) {
      allTemplates.forEach((t) => {
        const key = `${t.test_id}-${t.claim_kind}`;
        if (!existingClaimTypeIds.has(key)) {
          let defaultValue = '';
          if (t.claim_kind === 'endotoxins') defaultValue = '0';
          if (t.claim_kind === 'purity') defaultValue = '98';
          if (t.claim_kind === 'identity') defaultValue = sample.peptideName;

          newClaims.push({
            id: crypto.randomUUID(),
            testId: t.test_id,
            type: t.claim_kind,
            label: t.label,
            value: defaultValue,
            required: t.is_required,
          });
          changed = true;
        }
      });
    }

    // Always sync identity claims with the selected peptide name
    newClaims = newClaims.map((c) => {
      if (c.type === 'identity' && c.value !== sample.peptideName) {
        changed = true;
        return { ...c, value: sample.peptideName };
      }
      return c;
    });

    if (changed) {
      onChange({ claims: newClaims });
    }
  }, [allTemplates, selectedTestIds, sample.claims, sample.peptideName, onChange]);

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
        {sample.claims
          .filter((c) => c.type !== 'endotoxins')
          .map((claim) => (
            <div
              key={claim.id}
              className="flex items-end gap-3 animate-in fade-in slide-in-from-left-2 duration-200"
            >
              <div className="flex-1 space-y-1">
                {claim.testId === null ? (
                  <Input
                    label="Result Label"
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
                      readOnly={claim.type === 'identity'}
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
          Add Custom Expected Result
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          Expected results are for contributor context only. The COA is the source of truth.
        </p>
      </div>
    </div>
  );
};
