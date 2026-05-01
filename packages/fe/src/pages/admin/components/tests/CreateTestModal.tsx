import React, { useState, type ChangeEvent } from 'react';
import type { ClaimKind } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Textarea } from '../../../../components/ui/Textarea';
import { useToast } from '../../../../hooks/useToast';
import { useCreateTest, useCreateTestClaimTemplate } from '../../../../api/hooks/useLabs';

interface CreateTestModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

interface PendingTemplate {
  claim_kind: ClaimKind;
  label: string;
  is_required: boolean;
  sort_order: number;
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

export function CreateTestModal({ onClose, onCreated }: CreateTestModalProps): React.ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uspCode, setUspCode] = useState('');
  const [vialsRequired, setVialsRequired] = useState('1');
  const [pendingTemplates, setPendingTemplates] = useState<PendingTemplate[]>([]);
  const toast = useToast();

  const createTestMutation = useCreateTest();
  const createTemplateMutation = useCreateTestClaimTemplate();
  const isPending = createTestMutation.isPending || createTemplateMutation.isPending;

  const handleAddTemplate = (): void => {
    setPendingTemplates((prev) => [
      ...prev,
      { claim_kind: 'other', label: '', is_required: true, sort_order: prev.length },
    ]);
  };

  const handleRemoveTemplate = (idx: number): void => {
    setPendingTemplates((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTemplate = (idx: number, updates: Partial<PendingTemplate>): void => {
    setPendingTemplates((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };

  const handleCreate = async (): Promise<void> => {
    if (!name.trim() || !description.trim() || !vialsRequired) {
      toast.error('Name, description, and vials are required');
      return;
    }

    const hasPartial = pendingTemplates.some(
      (t) => (t.claim_kind && !t.label.trim()) || (!t.claim_kind && t.label.trim())
    );
    if (hasPartial) {
      toast.error('Complete all claim template fields first');
      return;
    }

    try {
      const created = await createTestMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        usp_code: uspCode.trim() || undefined,
        vials_required: Number(vialsRequired),
      });

      for (const tpl of pendingTemplates) {
        if (tpl.label.trim()) {
          await createTemplateMutation.mutateAsync({
            testId: created.id,
            claim_kind: tpl.claim_kind,
            label: tpl.label.trim(),
            is_required: tpl.is_required,
            sort_order: tpl.sort_order,
          });
        }
      }

      toast.success('Test created');
      onCreated?.();
      onClose();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to create test'));
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Test" size="lg">
      <div className="space-y-4">
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={3}
            required
          />
          <Input
            label="USP Code"
            value={uspCode}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUspCode(e.target.value)}
          />
          <Input
            label="Vials Required"
            type="number"
            min="1"
            value={vialsRequired}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setVialsRequired(e.target.value)}
            required
          />
        </div>

        <hr className="border-border" />

        <div>
          <h4 className="text-sm font-semibold text-text mb-2">Claim Templates</h4>
          {pendingTemplates.map((tpl, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-2 py-2 border-b border-border"
            >
              <select
                value={tpl.claim_kind}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  updateTemplate(idx, { claim_kind: e.target.value as ClaimKind })
                }
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
                value={tpl.label}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateTemplate(idx, { label: e.target.value })
                }
                placeholder="Label"
                className="flex-1 min-w-[120px] rounded-lg border border-border px-2 py-1 text-xs text-text bg-surface min-h-[36px]"
              />
              <label className="flex items-center gap-1 text-xs text-text-2">
                <input
                  type="checkbox"
                  checked={tpl.is_required}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateTemplate(idx, { is_required: e.target.checked })
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => handleRemoveTemplate(idx)}
                className="text-danger text-xs font-medium min-h-[36px] px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTemplate}
            className="text-primary text-xs font-medium mt-2 min-h-[36px]"
          >
            + Add Claim Template
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={isPending}
            onClick={() => {
              void handleCreate();
            }}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
