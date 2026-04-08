import { useState } from 'react';
import { SampleForm } from '../types';
import { Card } from '../../../components/ui/Card';
import { SectionA } from './SectionA';
import { SectionB } from './SectionB';
import { SectionC } from './SectionC';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface SampleFormCardProps {
  sample: SampleForm;
  index: number;
  onUpdate: (patch: Partial<SampleForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export const SampleFormCard = ({
  sample,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: SampleFormCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const title = sample.label || 'Untitled sample';

  return (
    <Card className="overflow-hidden border-2 border-border/50">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-surface-a border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Sample {index}
            </span>
          </div>
          <h3 className="text-base font-semibold text-text truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-1">
          {canRemove && (
            <button
              onClick={onRemove}
              className="p-2 text-text-3 hover:text-danger transition-colors"
              aria-label="Remove sample"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-text-3 hover:text-text transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6 space-y-10 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-3">
              1. What did you buy?
            </h4>
            <SectionA sample={sample} onChange={onUpdate} />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-3">
              2. Where is it going?
            </h4>
            <SectionB sample={sample} onChange={onUpdate} />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-3">
              3. What are you claiming?
            </h4>
            <SectionC
              sample={sample}
              selectedTestIds={sample.selectedTestIds}
              onChange={onUpdate}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
