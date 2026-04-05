/**
 * VendorCombobox — debounced API-backed vendor search.
 * Approved vendors show "✓ Verified" badge; pending show "⚠ Unverified".
 * No-match footer: "+ Request new vendor '[typed]'" → inline drawer.
 */
import React, { useRef, useState } from 'react';
import type { VendorSummaryDto, CreateVendorDto } from 'api-client';
import { useVendorSearch, useSubmitVendor } from '../../api/hooks/useVendors';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VendorComboboxProps {
  value: VendorSummaryDto | null;
  onChange: (vendor: VendorSummaryDto) => void;
  error?: string;
  required?: boolean;
}

// ─── Submit Drawer ────────────────────────────────────────────────────────────

interface SubmitVendorDrawerProps {
  initialName: string;
  onSubmit: (vendor: VendorSummaryDto) => void;
  onClose: () => void;
}

function SubmitVendorDrawer({
  initialName,
  onSubmit,
  onClose,
}: SubmitVendorDrawerProps): React.ReactElement {
  const [dto, setDto] = useState<CreateVendorDto>({ name: initialName });
  const toast = useToast();
  const { mutateAsync, isPending } = useSubmitVendor();

  const set = (field: keyof CreateVendorDto, value: string): void => {
    setDto((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!dto.name?.trim()) return;
    try {
      const result = await mutateAsync(dto);
      toast.success(
        'Vendor submitted for review. Campaign proceeds immediately — vendor shows as Unverified until approved.'
      );
      onSubmit({
        id: result.id,
        name: result.name,
        website: result.website ?? null,
        country: result.country ?? null,
        status: result.status,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit vendor');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-lg rounded-t-2xl shadow-xl p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <h3 className="text-lg font-bold text-text">Request New Vendor</h3>
        <p className="text-sm text-text-2">
          Submit an unlisted vendor for admin review. Your campaign proceeds immediately. The vendor
          shows as &ldquo;⚠ Unverified&rdquo; until approved.
        </p>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={dto.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="e.g. PureRawz"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Website <span className="text-text-3 font-normal">(optional)</span>
          </label>
          <input
            type="url"
            value={dto.website ?? ''}
            onChange={(e) => set('website', e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Country <span className="text-text-3 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={dto.country ?? ''}
            onChange={(e) => set('country', e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="e.g. United States"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Telegram Group <span className="text-text-3 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={dto.telegram_group ?? ''}
            onChange={(e) => set('telegram_group', e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="@VendorGroup"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface-a py-3 text-base font-medium text-text min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!dto.name?.trim() || isPending}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-primary py-3 text-base font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function VendorStatusBadge({ status }: { status: string }): React.ReactElement {
  if (status === 'approved') {
    return (
      <span className="text-xs font-medium text-success flex items-center gap-0.5">
        <span aria-hidden="true">✓</span> Verified
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-warning flex items-center gap-0.5">
      <span aria-hidden="true">⚠</span> Unverified
    </span>
  );
}

// ─── VendorCombobox ───────────────────────────────────────────────────────────

export function VendorCombobox({
  value,
  onChange,
  error,
  required = false,
}: VendorComboboxProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounce(query, 300);
  const { data: results = [], isFetching } = useVendorSearch(debouncedQ);

  const handleSelect = (vendor: VendorSummaryDto): void => {
    onChange(vendor);
    setQuery('');
    setOpen(false);
  };

  const handleSubmitNew = (vendor: VendorSummaryDto): void => {
    setShowDrawer(false);
    setOpen(false);
    onChange(vendor);
    setQuery('');
  };

  return (
    <div className="relative">
      <label className="text-sm font-medium text-text block mb-2">
        Vendor {required && <span className="text-danger">*</span>}
      </label>

      {/* Selected value pill */}
      {value !== null && !open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center gap-2 rounded-xl border border-primary bg-primary-l px-4 py-3 min-h-[44px] text-left"
        >
          <svg
            className="w-4 h-4 text-primary shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8l3.5 3.5L13 4.5" />
          </svg>
          <span className="text-base font-medium text-primary flex-1">{value.name}</span>
          <VendorStatusBadge status={value.status} />
          <span className="text-xs text-text-2 ml-2">Change</span>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search vendors..."
          className={[
            'w-full rounded-xl border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]',
            error ? 'border-danger' : 'border-border',
          ].join(' ')}
        />
      )}

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {isFetching && <div className="px-4 py-3 text-sm text-text-2">Searching…</div>}
            {!isFetching &&
              results.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => handleSelect(vendor)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-a min-h-[44px] flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{vendor.name}</p>
                    {vendor.country !== null && (
                      <p className="text-xs text-text-2">{vendor.country}</p>
                    )}
                  </div>
                  <VendorStatusBadge status={vendor.status} />
                </button>
              ))}

            {!isFetching && results.length === 0 && query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowDrawer(true);
                }}
                className="w-full text-left px-4 py-3 hover:bg-primary-l min-h-[44px]"
              >
                <span className="text-sm font-medium text-primary">
                  + Request new vendor: &ldquo;{query}&rdquo;
                </span>
              </button>
            )}

            {query.trim().length > 0 && results.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowDrawer(true);
                }}
                className="w-full text-left px-4 py-3 hover:bg-primary-l min-h-[44px] border-t border-border"
              >
                <span className="text-sm font-medium text-primary">
                  + Request new vendor: &ldquo;{query}&rdquo;
                </span>
              </button>
            )}

            {query.trim().length === 0 && !isFetching && (
              <div className="px-4 py-3 text-sm text-text-2">Start typing to search vendors…</div>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-danger mt-1">{error}</p>}

      {showDrawer && (
        <SubmitVendorDrawer
          initialName={query}
          onSubmit={handleSubmitNew}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  );
}
