import React, { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { PeptideDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Textarea } from '../../../../components/ui/Textarea';
import { useToast } from '../../../../hooks/useToast';
import { peptidesApi } from '../../../../api/apiClient';

interface PeptideModalProps {
  mode: 'create' | 'edit';
  peptide?: PeptideDto;
  onClose: () => void;
  onSaved?: () => void;
}

function extractApiError(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function PeptideModal({
  mode,
  peptide,
  onClose,
  onSaved,
}: PeptideModalProps): React.ReactElement {
  const [name, setName] = useState(peptide?.name ?? '');
  const [aliases, setAliases] = useState<string[]>(peptide?.aliases ?? []);
  const [aliasInput, setAliasInput] = useState('');
  const [description, setDescription] = useState(peptide?.description ?? '');
  const [isActive, setIsActive] = useState(peptide?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAddAlias = (): void => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed]);
      setAliasInput('');
    }
  };

  const handleAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handleRemoveAlias = (alias: string): void => {
    setAliases((prev) => prev.filter((a) => a !== alias));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'create') {
        await peptidesApi.createPeptide({
          name: name.trim(),
          aliases,
          description: description.trim() || undefined,
        });
        toast.success('Peptide created');
      } else if (peptide) {
        await peptidesApi.updatePeptide(peptide.id, {
          name: name.trim(),
          aliases,
          description: description.trim() || undefined,
          is_active: isActive,
        });
        toast.success('Peptide updated');
      }
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to save peptide'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'create' ? 'Add Peptide' : `Edit Peptide: ${peptide?.name}`}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          required
        />
        <div>
          <label className="text-sm font-medium text-text block mb-1">Aliases</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {aliases.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 bg-primary-l text-primary text-xs px-2 py-1 rounded-full"
              >
                {a}
                <button
                  type="button"
                  onClick={() => handleRemoveAlias(a)}
                  className="text-primary hover:text-primary-d"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={aliasInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAliasInput(e.target.value)}
            onKeyDown={handleAliasKeyDown}
            placeholder="Type alias and press Enter"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface min-h-[44px]"
          />
        </div>
        <Textarea
          label="Description"
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          rows={3}
        />
        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
