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

    if (cfg.config_key === 'global_minimums' && typeof val === 'object' && val !== null) {
      const v = val as Record<string, number>;
      if (Object.values(v).some((n) => n < 0)) {
        return 'Values cannot be negative';
      }
    }

    if (typeof val === 'object' && val !== null && 'value' in val) {
      const v = (val as { value: number }).value;
      if (typeof v === 'number' && v < 0) {
        return 'Value cannot be negative';
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
    // ─── Specialized Object Editors ──────────────────────────────────────────

    if (cfg.config_key === 'global_minimums' && typeof value === 'object' && value !== null) {
      const v = value as Record<string, number>;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { key: 'min_contribution_usd', label: 'Min Contribution (USD)' },
            { key: 'min_funding_threshold_usd', label: 'Min Funding Threshold (USD)' },
            { key: 'min_funding_threshold_percent', label: 'Min Funding Threshold (%)' },
            { key: 'min_withdrawal_usd', label: 'Min Withdrawal (USD)' },
          ].map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-text-2">{field.label}</label>
              <input
                type="number"
                step="0.01"
                value={v[field.key] ?? 0}
                onChange={(e) => updateObjectField(field.key, Number(e.target.value))}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
              />
            </div>
          ))}
        </div>
      );
    }

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

    if (
      [
        'platform_fee_percent',
        'max_campaign_multiplier',
        'auto_flag_threshold_usd',
        'max_withdrawal_per_day',
        'max_file_size_bytes',
      ].includes(cfg.config_key) &&
      typeof value === 'object' &&
      value !== null &&
      'value' in value
    ) {
      const v = value as { value: number };
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-2">Value</label>
          <input
            type="number"
            step={cfg.config_key.includes('percent') ? '0.1' : '1'}
            value={v.value ?? 0}
            onChange={(e) => updateObjectField('value', Number(e.target.value))}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
      );
    }

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

    // ─── Generic Fallback Editors ────────────────────────────────────────────

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
