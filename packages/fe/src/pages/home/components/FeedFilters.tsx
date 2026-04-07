import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

interface FeedFiltersProps {
  status: string;
  search: string;
  sort: string;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'created', label: 'Open' },
  { value: 'funded', label: 'Funded' },
  { value: 'samples_sent', label: 'In Lab' },
  { value: 'results_published', label: 'Results Out' },
  { value: 'resolved', label: 'Resolved' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'most_funded', label: 'Most Funded' },
  { value: 'least_funded', label: 'Least Funded' },
];

export function FeedFilters({
  status,
  search,
  sort,
  onStatusChange,
  onSearchChange,
  onSortChange,
}: FeedFiltersProps): React.ReactElement {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync local search with prop when prop changes (e.g. from URL or clear button)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, search]);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Search Row */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none z-10">
          <Search size={20} />
        </div>
        <Input
          placeholder="Search campaigns..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {localSearch && (
          <button
            onClick={() => {
              setLocalSearch('');
              onSearchChange('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Filters & Sort Row */}
      <div className="flex flex-col gap-3">
        {/* Status Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = status === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onStatusChange(opt.value)}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium min-h-[36px] transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-text-2 hover:bg-surface-a'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-2">Sort by</span>
          <Select
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="min-w-[160px]"
          />
        </div>
      </div>
    </div>
  );
}
