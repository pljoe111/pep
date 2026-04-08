import { useState } from 'react';
import type { SampleDto } from 'api-client';
import { Card } from '../../../components/ui/Card';
import { COAStateDisplay } from './COAStateDisplay';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

interface SampleCardProps {
  sample: SampleDto;
  isCreator: boolean;
  onReplaceCoaClick: (sampleId: string) => void;
}

export const SampleCard = ({ sample, isCreator, onReplaceCoaClick }: SampleCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const testsList = sample.tests.map((t) => t.name).join(' | ');

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-4">
        {/* Header Info */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-text leading-tight">{sample.sample_label}</h3>
          <div className="text-sm text-text-2">
            Peptide:{' '}
            <span className="text-text font-medium">{sample.peptide?.name || 'Unknown'}</span>
            {' · '}
            Vendor: <span className="text-text font-medium">{sample.vendor_name}</span>
          </div>
          <div className="text-sm text-text-2">
            Lab: <span className="text-text font-medium">{sample.target_lab.name}</span>
          </div>
          {testsList && <div className="text-xs text-text-3 pt-1">Tests: {testsList}</div>}
        </div>

        {sample.physical_description && (
          <p className="text-sm text-text-2 italic bg-surface-a p-2 rounded-lg border border-border/50">
            "{sample.physical_description}"
          </p>
        )}

        {/* COA State */}
        <div className="pt-2 border-t border-border/50">
          <COAStateDisplay
            coa={sample.coa}
            isCreator={isCreator}
            sampleId={sample.id}
            onReplaceClick={onReplaceCoaClick}
          />
        </div>

        {/* Claims Toggle */}
        {isCreator && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-text-2 hover:text-text transition-colors border-t border-border/50 -mb-2"
          >
            {isExpanded ? (
              <>
                Hide claims <ChevronUp size={16} />
              </>
            ) : (
              <>
                Show claims <ChevronDown size={16} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Claims Section */}
      {isCreator && isExpanded && (
        <div className="bg-surface-a border-t border-border p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-text-3 uppercase tracking-wide">Claims</h4>
            <ul className="space-y-2">
              {sample.claims.map((claim) => {
                let claimText = '';
                switch (claim.claim_type) {
                  case 'purity':
                    claimText = `Purity ≥ ${claim.purity_percent}%`;
                    break;
                  case 'mass':
                    claimText = `Mass: ${claim.mass_amount}${claim.mass_unit}`;
                    break;
                  case 'identity':
                    claimText = 'Identity: Pass';
                    break;
                  case 'sterility':
                    claimText = `Sterility: ${claim.sterility_pass ? 'Pass' : 'Fail'}`;
                    break;
                  case 'endotoxins':
                    claimText = `Endotoxins: ${claim.endotoxin_pass ? 'Pass' : 'Fail'} (${claim.endotoxin_value})`;
                    break;
                  case 'other':
                    claimText = claim.other_description || 'Custom claim';
                    break;
                  default:
                    claimText = 'Unknown claim';
                }

                return (
                  <li key={claim.id} className="text-sm text-text flex items-start gap-2">
                    <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {claimText}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <Info size={16} className="text-info flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Claims are for contributor context only — the COA is the source of truth.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
