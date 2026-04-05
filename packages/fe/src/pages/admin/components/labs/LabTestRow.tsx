import React, { useState, type ChangeEvent } from 'react';
import type { LabTestDto } from 'api-client';
import { labsApi } from '../../../../api/apiClient';
import {
  useDeactivateLabTest,
  useReactivateLabTest,
  useDeleteLabTest,
} from '../../../../api/hooks/useLabs';
import { useToast } from '../../../../hooks/useToast';
import { AdminActionButton } from '../shared/AdminActionButton';

interface LabTestRowProps {
  labId: string;
  labTest: LabTestDto;
  onSaved: () => void;
  mode: 'edit' | 'create';
  onRemoveFromPending?: () => void;
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

export function LabTestRow({
  labId,
  labTest,
  onSaved,
  mode,
  onRemoveFromPending,
}: LabTestRowProps): React.ReactElement {
  const [price, setPrice] = useState(String(labTest.price_usd));
  const [turnaround, setTurnaround] = useState(String(labTest.typical_turnaround_days));
  const [vials, setVials] = useState(String(labTest.vials_required));
  const [endotoxinMode] = useState<'pass_fail' | 'exact_value'>(labTest.endotoxin_mode);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deactivateMutation = useDeactivateLabTest();
  const reactivateMutation = useReactivateLabTest();
  const deleteMutation = useDeleteLabTest();
  const toast = useToast();

  const hasErrors = !price || !turnaround || !vials || Number(vials) < 1;

  const handleSave = async (): Promise<void> => {
    if (hasErrors) return;
    try {
      await labsApi.updateTest(labId, labTest.test_id, {
        price_usd: Number(price),
        typical_turnaround_days: Number(turnaround),
        vials_required: Number(vials),
        endotoxin_mode: endotoxinMode,
      });
      toast.success('Test updated');
      onSaved();
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Failed to update test'));
    }
  };

  const handleDisable = (): void => {
    deactivateMutation.mutate(
      { labId, testId: labTest.test_id },
      {
        onSuccess: () => {
          toast.success('Test disabled');
          onSaved();
        },
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to disable')),
      }
    );
  };

  const handleReactivate = (): void => {
    reactivateMutation.mutate(
      { labId, testId: labTest.test_id },
      {
        onSuccess: () => {
          toast.success('Test reactivated');
          onSaved();
        },
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to reactivate')),
      }
    );
  };

  const handleDelete = (): void => {
    deleteMutation.mutate(
      { labId, testId: labTest.test_id },
      {
        onSuccess: () => {
          toast.success('Test deleted');
          onSaved();
        },
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to delete')),
      }
    );
  };

  if (mode === 'create') {
    return (
      <div className="p-4 bg-surface hover:bg-surface-a transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-text truncate">{labTest.test_name}</span>
          <button
            type="button"
            onClick={onRemoveFromPending}
            className="text-danger text-[10px] font-bold uppercase tracking-wider hover:underline px-2 py-1"
          >
            Remove Test
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Price</p>
            <p className="text-sm font-mono text-text">${price}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Days</p>
            <p className="text-sm text-text">{turnaround}</p>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Vials</p>
            <p className="text-sm text-text">{vials}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 bg-surface hover:bg-surface-a transition-colors ${!labTest.is_active ? 'opacity-60 grayscale-[0.5]' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-text truncate">{labTest.test_name}</p>
          {!labTest.is_active && (
            <p className="text-[10px] font-bold uppercase text-text-3 tracking-wider">Disabled</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {labTest.is_active ? (
            <>
              <AdminActionButton
                variant="ghost"
                onClick={() => {
                  void handleSave();
                }}
                disabled={hasErrors}
              >
                Save
              </AdminActionButton>
              <button
                type="button"
                onClick={handleDisable}
                className="text-danger text-[10px] font-bold uppercase tracking-wider hover:underline px-2 py-1"
              >
                Disable
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReactivate}
                className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline px-2 py-1"
              >
                Reactivate
              </button>
              {showDeleteConfirm ? (
                <>
                  <AdminActionButton
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleteMutation.isPending}
                  >
                    Confirm
                  </AdminActionButton>
                  <AdminActionButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </AdminActionButton>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-danger text-[10px] font-bold uppercase tracking-wider hover:underline px-2 py-1"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Price</p>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3 text-xs">$</span>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-border pl-5 pr-2 py-1.5 text-sm font-mono text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
              disabled={!labTest.is_active}
            />
          </div>
          {!price && <p className="text-[10px] text-danger mt-1 font-medium">Required</p>}
        </div>
        <div className="w-20 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Days</p>
          <input
            type="number"
            value={turnaround}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTurnaround(e.target.value)}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
            disabled={!labTest.is_active}
          />
          {!turnaround && <p className="text-[10px] text-danger mt-1 font-medium">Required</p>}
        </div>
        <div className="w-20 shrink-0">
          <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Vials</p>
          <input
            type="number"
            min="1"
            value={vials}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setVials(e.target.value)}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm text-text bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[44px]"
            disabled={!labTest.is_active}
          />
          {(!vials || Number(vials) < 1) && (
            <p className="text-[10px] text-danger mt-1 font-medium">Required</p>
          )}
        </div>
      </div>
    </div>
  );
}
