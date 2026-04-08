import { useLabs, useLabTests } from '../../../api/hooks/useLabs';
import { SampleForm } from '../types';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { formatUSD } from '../../../lib/formatters';

interface SectionBProps {
  sample: SampleForm;
  onChange: (patch: Partial<SampleForm>) => void;
}

export const SectionB = ({ sample, onChange }: SectionBProps) => {
  const { data: labsResponse, isLoading: labsLoading } = useLabs(true, true);
  const { data: tests = [], isLoading: testsLoading } = useLabTests(sample.targetLabId);

  const labs = labsResponse?.data || [];

  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const labId = e.target.value;
    const lab = labs.find((l) => l.id === labId);
    onChange({
      targetLabId: labId,
      targetLabName: lab?.name || '',
      selectedTestIds: [],
    });
  };

  const toggleTest = (testId: string) => {
    const current = sample.selectedTestIds;
    const next = current.includes(testId)
      ? current.filter((id) => id !== testId)
      : [...current, testId];
    onChange({ selectedTestIds: next });
  };

  const selectedTests = tests.filter((t) => sample.selectedTestIds.includes(t.test_id));
  const totalVials = selectedTests.reduce((sum, t) => sum + t.vials_required, 0);
  const totalPrice = selectedTests.reduce((sum, t) => sum + Number(t.price_usd), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Target Lab</label>
        {labsLoading ? (
          <div className="flex items-center gap-2 text-text-3 text-sm py-3">
            <Spinner size="sm" />
            Loading labs...
          </div>
        ) : (
          <Select
            value={sample.targetLabId}
            onChange={handleLabChange}
            options={[
              { value: '', label: 'Select a lab' },
              ...labs.map((l) => ({
                value: l.id,
                label: `${l.name} (${l.country})`,
              })),
            ]}
          />
        )}
      </div>

      {sample.targetLabId && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-3">
            Available Tests
          </h4>

          {testsLoading ? (
            <div className="flex items-center gap-2 text-text-3 text-sm py-3">
              <Spinner size="sm" />
              Loading tests...
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden bg-surface-a">
              <div className="divide-y divide-border">
                {tests.map((test) => (
                  <label
                    key={test.test_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={sample.selectedTestIds.includes(test.test_id)}
                      onChange={() => toggleTest(test.test_id)}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{test.test_name}</p>
                      <p className="text-xs text-text-3">
                        {test.vials_required} {test.vials_required === 1 ? 'vial' : 'vials'}{' '}
                        required
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-text">
                      {formatUSD(test.price_usd)}
                    </div>
                  </label>
                ))}
              </div>

              {tests.length === 0 && (
                <div className="p-8 text-center text-sm text-text-3">
                  No tests available for this lab.
                </div>
              )}

              {sample.selectedTestIds.length > 0 && (
                <div className="bg-surface border-t border-border p-4 flex justify-between items-center">
                  <div className="text-xs text-text-3">
                    Total: {totalVials} {totalVials === 1 ? 'vial' : 'vials'}
                  </div>
                  <div className="text-sm font-bold text-text">
                    Estimated: {formatUSD(totalPrice)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
