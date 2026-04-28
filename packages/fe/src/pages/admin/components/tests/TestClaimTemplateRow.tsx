import React, { useState, type ChangeEvent } from 'react';
import type { TestClaimTemplateDto, ClaimKind } from 'api-client';
import {
  useCreateTestClaimTemplate,
  useDeleteTestClaimTemplate,
} from '../../../../api/hooks/useLabs';
import { useToast } from '../../../../hooks/useToast';
import axiosInstance from '../../../../api/axiosInstance';

interface TestClaimTemplateRowProps {
  template?: TestClaimTemplateDto;
  testId: string;
  onSaved: () => void;
  onRemove: () => void;
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

export function TestClaimTemplateRow({
  template,
  testId,
  onSaved,
  onRemove,
}: TestClaimTemplateRowProps): React.ReactElement {
  const [claimKind, setClaimKind] = useState<ClaimKind>(template?.claim_kind ?? 'other');
  const [label, setLabel] = useState(template?.label ?? '');
  const [isRequired, setIsRequired] = useState(template?.is_required ?? true);
  const [sortOrder, setSortOrder] = useState(String(template?.sort_order ?? 0));
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateTestClaimTemplate();
  const deleteMutation = useDeleteTestClaimTemplate();
  const toast = useToast();

  const handleSave = async (): Promise<void> => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      if (template) {
        await axiosInstance.patch(`/tests/claim-templates/${template.id}`, {
          label: label.trim(),
          is_required: isRequired,
          sort_order: Number(sortOrder),
        });
        toast.success('Template updated');
      } else {
        await createMutation.mutateAsync({
          testId,
          claim_kind: claimKind,
          label: label.trim(),
          is_required: isRequired,
          sort_order: Number(sortOrder),
        });
        toast.success('Template added');
      }
      onSaved();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (): void => {
    if (template) {
      deleteMutation.mutate(
        { templateId: template.id, testId },
        {
          onSuccess: () => {
            toast.success('Template removed');
            onRemove();
          },
          onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to remove')),
        }
      );
    } else {
      onRemove();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0">
      <select
        value={claimKind}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setClaimKind(e.target.value as ClaimKind)}
        className="rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
      >
        <option value="mass">Mass</option>
        <option value="purity">Purity</option>
        <option value="identity">Identity</option>
        <option value="endotoxins">Endotoxins</option>
        <option value="sterility">Sterility</option>
        <option value="other">Other</option>
      </select>
      <input
        type="text"
        value={label}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
        placeholder="Label"
        className="flex-1 min-w-[120px] rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
      />
      <label className="flex items-center gap-1 text-xs text-text-2">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setIsRequired(e.target.checked)}
        />
        Required
      </label>
      <input
        type="number"
        value={sortOrder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSortOrder(e.target.value)}
        className="w-16 rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
      />
      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={saving || !label.trim()}
        className="text-primary text-xs font-medium min-h-[36px] px-2 disabled:opacity-50"
      >
        {saving ? '...' : template ? 'Save' : 'Add'}
      </button>
      <button
        type="button"
        onClick={handleRemove}
        className="text-danger text-xs font-medium min-h-[36px] px-2"
      >
        Remove
      </button>
    </div>
  );
}
