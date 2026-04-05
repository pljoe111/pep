/**
 * PeptideCombobox — in-memory fuzzy search over active peptides.
 * Backed by usePeptides() (staleTime: Infinity → load once per session).
 * On no match, shows "+ Submit '[typed]' as new peptide" → inline drawer.
 */
import React, { useRef, useState } from 'react';
import type { PeptideSummaryDto } from 'api-client';
import { usePeptides, useSubmitPeptide } from '../../api/hooks/usePeptides';
import { useToast } from '../../hooks/useToast';

// ─── Fuzzy match helper ───────────────────────────────────────────────────────

function matchesPeptide(peptide: PeptideSummaryDto, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const nameMatch = peptide.name.toLowerCase().includes(q);
  const aliasMatch = peptide.aliases.some((a) => a.toLowerCase().includes(q));
  return nameMatch || aliasMatch;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PeptideComboboxProps {
  value: PeptideSummaryDto | null;
  onChange: (peptide: PeptideSummaryDto) => void;
  error?: string;
  required?: boolean;
}

// ─── Submit Drawer ────────────────────────────────────────────────────────────

interface SubmitDrawerProps {
  initialName: string;
  onSubmit: (peptide: PeptideSummaryDto) => void;
  onClose: () => void;
}

function SubmitPeptideDrawer({
  initialName,
  onSubmit,
  onClose,
}: SubmitDrawerProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [aliases, setAliases] = useState('');
  const [description, setDescription] = useState('');
  const toast = useToast();
  const { mutateAsync, isPending } = useSubmitPeptide();

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) return;
    try {
      const result = await mutateAsync({
        name: name.trim(),
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        description: description.trim() || undefined,
      });
      toast.success('Peptide submitted for review. You can proceed with your campaign.');
      onSubmit({
        id: result.id,
        name: result.name,
        aliases: result.aliases,
        is_active: result.is_active,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit peptide');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-lg rounded-t-2xl shadow-xl p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <h3 className="text-lg font-bold text-text">Submit New Peptide</h3>
        <p className="text-sm text-text-2">
          Submit an unknown peptide for admin review. Your campaign will proceed immediately. Public
          pages will show &ldquo;⚠ Unreviewed Peptide&rdquo; until approved.
        </p>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="e.g. Tirzepatide"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Aliases <span className="text-text-3 font-normal">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            placeholder="e.g. LY3298176, GIP/GLP-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text block mb-1">
            Description <span className="text-text-3 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="Brief description of this peptide..."
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
            disabled={!name.trim() || isPending}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-primary py-3 text-base font-medium text-white min-h-[44px] disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PeptideCombobox ──────────────────────────────────────────────────────────

export function PeptideCombobox({
  value,
  onChange,
  error,
  required = false,
}: PeptideComboboxProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: peptides = [] } = usePeptides();

  const filtered = query.trim()
    ? peptides.filter((p) => matchesPeptide(p, query))
    : peptides.slice(0, 8);

  const showSubmitRow = query.trim().length > 0 && filtered.length === 0;

  const handleSelect = (peptide: PeptideSummaryDto): void => {
    onChange(peptide);
    setQuery('');
    setOpen(false);
  };

  const handleSubmitNew = (peptide: PeptideSummaryDto): void => {
    setShowDrawer(false);
    setOpen(false);
    onChange(peptide);
    setQuery('');
  };

  return (
    <div className="relative">
      <label className="text-sm font-medium text-text block mb-2">
        Peptide {required && <span className="text-danger">*</span>}
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
          {/* Checkmark */}
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
          <span className="text-base font-medium text-primary">{value.name}</span>
          <span className="text-xs text-text-2 ml-auto">Change</span>
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
          placeholder="Search peptides..."
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
            {filtered.map((peptide) => (
              <button
                key={peptide.id}
                type="button"
                onClick={() => handleSelect(peptide)}
                className="w-full text-left px-4 py-3 hover:bg-surface-a min-h-[44px] flex items-start gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-text">{peptide.name}</p>
                  {peptide.aliases.length > 0 && (
                    <p className="text-xs text-text-2">{peptide.aliases.join(', ')}</p>
                  )}
                </div>
              </button>
            ))}

            {/* Submit new row */}
            {(showSubmitRow || filtered.length === 0) && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowDrawer(true);
                }}
                className="w-full text-left px-4 py-3 hover:bg-primary-l min-h-[44px] border-t border-border"
              >
                <span className="text-sm font-medium text-primary">
                  + Submit &ldquo;{query || 'new peptide'}&rdquo; for review
                </span>
              </button>
            )}

            {filtered.length === 0 && !query.trim() && (
              <div className="px-4 py-3 text-sm text-text-2">No peptides found.</div>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-danger mt-1">{error}</p>}

      {showDrawer && (
        <SubmitPeptideDrawer
          initialName={query}
          onSubmit={handleSubmitNew}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  );
}
