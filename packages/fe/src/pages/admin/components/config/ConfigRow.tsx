import React, { useState, type ChangeEvent } from 'react';
import type { ConfigurationDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { AdminActionButton } from '../shared/AdminActionButton';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';

interface ConfigRowProps {
  cfg: ConfigurationDto;
  onSave: (value: unknown) => Promise<void>;
  isSaving: boolean;
}

/** snake_case key → human-readable label */
function formatKey(key: string): string {
  return key
    .replace(/_usd$/, ' (USD)')
    .replace(/_percent$/, ' (%)')
    .replace(/_bps$/, ' (bps)')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ConfigRow({ cfg, onSave, isSaving }: ConfigRowProps): React.ReactElement {
  const [value, setValue] = useState<unknown>(cfg.config_value);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasChanges = JSON.stringify(value) !== JSON.stringify(cfg.config_value);

  const validate = (val: unknown): string | null => {
    if (cfg.config_key === 'default_sweep_wallet' && typeof val === 'object' && val !== null) {
      const addr = (val as { address?: string }).address;
      if (addr && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
        return 'Invalid Solana address';
      }
    }

    if (typeof val === 'object' && val !== null) {
      const nums = Object.values(val as Record<string, unknown>).filter(
        (v) => typeof v === 'number'
      );
      if (nums.some((n) => n < 0)) {
        return 'Values cannot be negative';
      }
    }

    return null;
  };

  const handleSaveClick = (): void => {
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmSave = async (): Promise<void> => {
    await onSave(value);
    setShowConfirm(false);
  };

  const updateObjectField = (field: string, fieldValue: unknown): void => {
    if (typeof value === 'object' && value !== null) {
      const newValue = { ...value, [field]: fieldValue };
      setValue(newValue);
      setError(validate(newValue));
    }
  };

  const renderInput = (): React.ReactElement => {
    // ─── Special: default_sweep_wallet — Solana address needs mono + validation ──
    if (cfg.config_key === 'default_sweep_wallet' && typeof value === 'object' && value !== null) {
      const v = value as { address?: string };
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-2">Solana Wallet Address</label>
          <input
            type="text"
            value={v.address ?? ''}
            onChange={(e) => updateObjectField('address', e.target.value)}
            placeholder="Enter Solana address..."
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px] font-mono"
          />
        </div>
      );
    }

    // ─── Special: valid_mass_units — array serialised as comma-separated string ──
    if (cfg.config_key === 'valid_mass_units' && typeof value === 'object' && value !== null) {
      const v = value as { units?: string[] };
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-2">Units (comma separated)</label>
          <input
            type="text"
            value={(v.units ?? []).join(', ')}
            onChange={(e) =>
              updateObjectField(
                'units',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
      );
    }

    // ─── Generic: { value: <primitive> } single-value wrapper ────────────────────
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      'value' in value
    ) {
      const v = value as { value: unknown };
      if (typeof v.value === 'number') {
        return (
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-2">Value</label>
            <input
              type="number"
              step={cfg.config_key.includes('percent') ? '0.1' : '1'}
              value={v.value}
              onChange={(e) => updateObjectField('value', Number(e.target.value))}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
            />
          </div>
        );
      }
      if (typeof v.value === 'string') {
        return (
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-2">Value</label>
            <input
              type="text"
              value={v.value}
              onChange={(e) => updateObjectField('value', e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
            />
          </div>
        );
      }
    }

    // ─── Generic: flat Record<string, primitive> — auto-render one input per key ─
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      const allPrimitive = entries.every(([, v]) =>
        ['number', 'string', 'boolean'].includes(typeof v)
      );
      if (allPrimitive) {
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries.map(([key, fieldValue]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-text-2">{formatKey(key)}</label>
                {typeof fieldValue === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm text-text min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={fieldValue}
                      onChange={(e) => updateObjectField(key, e.target.checked)}
                    />
                    {fieldValue ? 'true' : 'false'}
                  </label>
                ) : (
                  <input
                    type={typeof fieldValue === 'number' ? 'number' : 'text'}
                    step={typeof fieldValue === 'number' ? '0.01' : undefined}
                    value={typeof fieldValue === 'number' ? fieldValue : (fieldValue as string)}
                    onChange={(e) =>
                      updateObjectField(
                        key,
                        typeof fieldValue === 'number' ? Number(e.target.value) : e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
                  />
                )}
              </div>
            ))}
          </div>
        );
      }
    }

    // ─── Primitive fallbacks ──────────────────────────────────────────────────────

    if (typeof value === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.checked)}
          />
          {value ? 'true' : 'false'}
        </label>
      );
    }
    if (typeof value === 'number') {
      return (
        <input
          type="number"
          step="0.01"
          value={String(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(Number(e.target.value))}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
        />
      );
    }
    if (typeof value === 'string') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
        />
      );
    }

    // ─── JSON textarea fallback for complex / unknown shapes ─────────────────────
    return (
      <textarea
        value={JSON.stringify(value, null, 2)}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          try {
            setValue(JSON.parse(e.target.value));
          } catch {
            // ignore parse error while typing
          }
        }}
        rows={4}
        className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface font-mono"
      />
    );
  };

  return (
    <Card padding="md">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <code className="font-mono font-bold text-sm text-text">{cfg.config_key}</code>
        </div>
        {cfg.description && <p className="text-xs text-text-2">{cfg.description}</p>}
        {renderInput()}
        {error && <p className="text-xs text-color-danger">{error}</p>}
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-3">
            Updated: {cfg.updated_at ? cfg.updated_at.slice(0, 10) : '—'}
          </p>
          <AdminActionButton
            variant="ghost"
            onClick={handleSaveClick}
            disabled={!hasChanges || isSaving || !!error}
            loading={isSaving}
          >
            Save
          </AdminActionButton>
        </div>
      </div>

      {showConfirm && (
        <AdminConfirmModal
          title={`Update ${cfg.config_key}`}
          confirmLabel="Confirm Update"
          confirmVariant="primary"
          onClose={() => setShowConfirm(false)}
          onConfirm={() => {
            void handleConfirmSave();
          }}
          isPending={isSaving}
          body={
            <div className="space-y-4">
              <p className="text-sm text-text-2">
                Are you sure you want to update this configuration?
              </p>
              <div className="space-y-3">
                {typeof value === 'object' &&
                value !== null &&
                typeof cfg.config_value === 'object' &&
                cfg.config_value !== null ? (
                  Object.keys({ ...value, ...(cfg.config_value as object) }).map((key) => {
                    const prev = (cfg.config_value as Record<string, unknown>)[key];
                    const next = (value as Record<string, unknown>)[key];
                    if (JSON.stringify(prev) === JSON.stringify(next)) return null;

                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-border bg-surface p-3 space-y-2"
                      >
                        <div className="text-xs font-bold font-mono text-text uppercase tracking-wider">
                          {key}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-text-3">
                              From
                            </span>
                            <div className="rounded bg-surface-a px-2 py-1 text-xs font-mono text-text-2 border border-border break-all">
                              {JSON.stringify(prev)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-color-primary">
                              To
                            </span>
                            <div className="rounded bg-primary-l px-2 py-1 text-xs font-mono text-text border border-primary/20 break-all">
                              {JSON.stringify(next)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-3">
                        From
                      </span>
                      <pre className="max-h-[150px] overflow-auto rounded-lg bg-surface-a p-3 text-xs font-mono text-text-2 border border-border whitespace-pre-wrap break-all">
                        {JSON.stringify(cfg.config_value, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-color-primary">
                        To
                      </span>
                      <pre className="max-h-[150px] overflow-auto rounded-lg bg-primary-l/20 p-3 text-xs font-mono text-text border border-primary/20 whitespace-pre-wrap break-all">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />
      )}
    </Card>
  );
}
