import React, { useState, type ChangeEvent } from 'react';
import type { TestDto } from 'api-client';
import { AdminActionButton } from '../shared/AdminActionButton';

interface AddTestToLabFormProps {
  availableTests: TestDto[];
  onAdd: (data: {
    testId: string;
    price: string;
    days: string;
    vials: string;
    endotoxinMode: 'pass_fail' | 'exact_value';
  }) => void;
  isLoading?: boolean;
}

export function AddTestToLabForm({
  availableTests,
  onAdd,
  isLoading = false,
}: AddTestToLabFormProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const [vials, setVials] = useState('');
  const [endotoxinMode, setEndotoxinMode] = useState<'pass_fail' | 'exact_value'>('pass_fail');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (availableTests.length === 0) {
    return (
      <div className="bg-surface-a rounded-xl p-3">
        <p className="text-xs text-text-3">No more tests available to add.</p>
      </div>
    );
  }

  const selectedTest = availableTests.find((t) => t.id === selectedTestId);
  const hasEndotoxins =
    selectedTest?.claim_templates?.some((ct) => ct.claim_kind === 'endotoxins') ?? false;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedTestId) newErrors.test = 'Test is required';
    if (!price || Number(price) < 0.01) newErrors.price = 'Price must be at least 0.01';
    if (!days || Number(days) < 1) newErrors.days = 'Days must be at least 1';
    if (!vials || Number(vials) < 1) newErrors.vials = 'Vials must be at least 1';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = (): void => {
    if (!validate()) return;
    onAdd({ testId: selectedTestId, price, days, vials, endotoxinMode });
    setSelectedTestId('');
    setPrice('');
    setDays('');
    setVials('');
    setEndotoxinMode('pass_fail');
    setErrors({});
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full py-4 flex items-center justify-center gap-2 text-primary hover:bg-primary-l/30 transition-colors rounded-lg border-2 border-dashed border-primary/20"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-bold uppercase tracking-wider">Add New Test to Lab</span>
      </button>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-primary-l/10 rounded-lg border border-primary/10">
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">
          Select Test
        </p>
        <select
          value={selectedTestId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setSelectedTestId(e.target.value);
            setErrors((prev) => ({ ...prev, test: '' }));
          }}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
        >
          <option value="">Select a test...</option>
          {availableTests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {errors.test && <p className="text-[10px] text-danger mt-1 font-medium">{errors.test}</p>}
      </div>

      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Price</p>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3 text-xs">$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setPrice(e.target.value);
                setErrors((prev) => ({ ...prev, price: '' }));
              }}
              className="w-full rounded-lg border border-border pl-5 pr-2 py-2 text-sm font-mono text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
            />
          </div>
          {errors.price && <p className="text-[10px] text-danger mt-1 font-medium">Required</p>}
        </div>

        <div className="w-20 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Days</p>
          <input
            type="number"
            placeholder="0"
            value={days}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDays(e.target.value);
              setErrors((prev) => ({ ...prev, days: '' }));
            }}
            className="w-full rounded-lg border border-border px-2 py-2 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
          />
          {errors.days && <p className="text-[10px] text-danger mt-1 font-medium">Required</p>}
        </div>

        <div className="w-20 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Vials</p>
          <input
            type="number"
            min="1"
            placeholder="1"
            value={vials}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setVials(e.target.value);
              setErrors((prev) => ({ ...prev, vials: '' }));
            }}
            className="w-full rounded-lg border border-border px-2 py-2 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
          />
          {errors.vials && <p className="text-[10px] text-danger mt-1 font-medium">Required</p>}
        </div>
      </div>

      {hasEndotoxins && (
        <div className="flex items-center gap-3 bg-primary-l/30 p-3 rounded-lg border border-primary-l">
          <span className="text-xs font-semibold text-primary-d uppercase tracking-wider">
            Endotoxin Mode:
          </span>
          <select
            value={endotoxinMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setEndotoxinMode(e.target.value as 'pass_fail' | 'exact_value')
            }
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[36px]"
          >
            <option value="pass_fail">Pass/Fail</option>
            <option value="exact_value">Exact Value (EU/mL)</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-primary/10">
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setErrors({});
          }}
          className="text-text-3 text-[10px] font-bold uppercase tracking-wider hover:text-text px-4 py-2"
        >
          Cancel
        </button>
        <AdminActionButton
          variant="primary"
          size="md"
          onClick={handleAdd}
          loading={isLoading}
          className="px-10"
        >
          Save Test
        </AdminActionButton>
      </div>
    </div>
  );
}
