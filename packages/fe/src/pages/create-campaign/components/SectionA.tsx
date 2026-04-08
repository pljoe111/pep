import { SampleForm } from '../types';
import { PeptideCombobox } from '../../../components/wizard/PeptideCombobox';
import { VendorCombobox } from '../../../components/wizard/VendorCombobox';
import { Input } from '../../../components/ui/Input';
import type { PeptideSummaryDto, VendorSummaryDto } from 'api-client';

interface SectionAProps {
  sample: SampleForm;
  onChange: (patch: Partial<SampleForm>) => void;
}

export const SectionA = ({ sample, onChange }: SectionAProps) => {
  const handlePeptideChange = (p: PeptideSummaryDto) => {
    const patch: Partial<SampleForm> = {
      peptideId: p.id,
      peptideName: p.name,
    };

    if (!sample.label && sample.vendorName) {
      patch.label = `${p.name} from ${sample.vendorName}`;
    } else if (!sample.label) {
      patch.label = p.name;
    }

    onChange(patch);
  };

  const handleVendorChange = (v: VendorSummaryDto) => {
    const patch: Partial<SampleForm> = {
      vendorId: v.id,
      vendorName: v.name,
    };

    if (!sample.label && sample.peptideName) {
      patch.label = `${sample.peptideName} from ${v.name}`;
    } else if (!sample.label) {
      patch.label = `Sample from ${v.name}`;
    }

    onChange(patch);
  };

  const today = new Date().toISOString().split('T')[0];
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const minDate = tenYearsAgo.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PeptideCombobox
          value={
            sample.peptideId
              ? {
                  id: sample.peptideId,
                  name: sample.peptideName,
                  aliases: [], // Not needed for value display
                  is_active: true,
                }
              : null
          }
          onChange={handlePeptideChange}
          required
        />

        <VendorCombobox
          value={
            sample.vendorId
              ? {
                  id: sample.vendorId,
                  name: sample.vendorName,
                  status: 'approved', // Placeholder for display
                  website: null,
                  country: null,
                }
              : null
          }
          onChange={handleVendorChange}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Purchase Date"
          type="date"
          value={sample.purchaseDate}
          onChange={(e) => onChange({ purchaseDate: e.target.value })}
          max={today}
          min={minDate}
          required
        />

        <Input
          label="Sample Label"
          placeholder="e.g. BPC-157 from Swisschems"
          value={sample.label}
          onChange={(e) => onChange({ label: e.target.value })}
          required
        />
      </div>

      <Input
        label="Physical Description (Optional)"
        placeholder="e.g. White powder, gray capsules, unflavoured"
        value={sample.physicalDescription}
        onChange={(e) => onChange({ physicalDescription: e.target.value })}
      />
    </div>
  );
};
