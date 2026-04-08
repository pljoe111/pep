import React from 'react';

interface MyCampaignsFiltersProps {
  value: string;
  onChange: (status: string) => void;
}

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'created' },
  { label: 'Funded', value: 'funded' },
  { label: 'In Lab', value: 'samples_sent' },
  { label: 'Resolved', value: 'resolved' },
];

export function MyCampaignsFilters({ value, onChange }: MyCampaignsFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
      {FILTERS.map((filter) => {
        const isActive = value === filter.value;
        return (
          <button
            key={filter.value}
            onClick={() => onChange(filter.value)}
            className={`
              min-h-[36px] px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors
              ${
                isActive
                  ? 'bg-primary text-white rounded-full'
                  : 'bg-surface border border-border text-text-2 rounded-full hover:border-primary/50'
              }
            `}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
