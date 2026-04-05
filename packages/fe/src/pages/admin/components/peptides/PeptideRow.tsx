import React, { useState } from 'react';
import type { PeptideDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { AdminStatusBadge } from '../shared/AdminStatusBadge';
import { AdminActionButton } from '../shared/AdminActionButton';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import {
  useApprovePeptide,
  useDisablePeptide,
  useEnablePeptide,
  useDeletePeptide,
} from '../../../../api/hooks/usePeptides';
import { useToast } from '../../../../hooks/useToast';

interface PeptideRowProps {
  peptide: PeptideDto;
  onEdit: (p: PeptideDto) => void;
  onReject: (p: PeptideDto) => void;
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

export function PeptideRow({ peptide, onEdit, onReject }: PeptideRowProps): React.ReactElement {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const approveMutation = useApprovePeptide();
  const disableMutation = useDisablePeptide();
  const enableMutation = useEnablePeptide();
  const deleteMutation = useDeletePeptide();
  const toast = useToast();

  const isUnreviewed = !peptide.is_active && peptide.approved_at === null;
  const isActive = peptide.is_active;
  const isDisabled = !peptide.is_active && peptide.approved_at !== null;

  return (
    <Card padding="sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text">{peptide.name}</p>
          {peptide.aliases.length > 0 && (
            <p className="text-xs text-text-2 mt-0.5">{peptide.aliases.join(', ')}</p>
          )}
          {peptide.description && (
            <p className="text-xs text-text-3 line-clamp-1 mt-0.5" title={peptide.description}>
              {peptide.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge
            status={isUnreviewed ? 'unreviewed' : isActive ? 'active' : 'disabled'}
          />
          <div className="flex flex-wrap gap-1.5">
            {isUnreviewed && (
              <>
                <AdminActionButton
                  variant="primary"
                  loading={approveMutation.isPending}
                  onClick={() => {
                    approveMutation.mutate(peptide.id, {
                      onSuccess: () => toast.success(`${peptide.name} approved`),
                      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to approve')),
                    });
                  }}
                >
                  Approve
                </AdminActionButton>
                <AdminActionButton variant="danger" onClick={() => onReject(peptide)}>
                  Reject
                </AdminActionButton>
              </>
            )}
            {isActive && (
              <>
                <AdminActionButton variant="ghost" onClick={() => onEdit(peptide)}>
                  Edit
                </AdminActionButton>
                <AdminActionButton
                  variant="ghost"
                  loading={disableMutation.isPending}
                  onClick={() => {
                    disableMutation.mutate(peptide.id, {
                      onSuccess: () => toast.success(`${peptide.name} disabled`),
                      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to disable')),
                    });
                  }}
                >
                  Disable
                </AdminActionButton>
              </>
            )}
            {isDisabled && (
              <>
                <AdminActionButton
                  variant="ghost"
                  loading={enableMutation.isPending}
                  onClick={() => {
                    enableMutation.mutate(peptide.id, {
                      onSuccess: () => toast.success(`${peptide.name} enabled`),
                      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to enable')),
                    });
                  }}
                >
                  Enable
                </AdminActionButton>
                {showDeleteConfirm ? (
                  <AdminConfirmModal
                    title="Delete Peptide"
                    body={<p className="text-sm text-text">Delete {peptide.name} permanently?</p>}
                    confirmLabel="Delete"
                    confirmVariant="danger"
                    onConfirm={() => {
                      deleteMutation.mutate(peptide.id, {
                        onSuccess: () => {
                          toast.success(`${peptide.name} deleted`);
                          setShowDeleteConfirm(false);
                        },
                        onError: (e: unknown) =>
                          toast.error(extractApiError(e, 'Failed to delete')),
                      });
                    }}
                    onClose={() => setShowDeleteConfirm(false)}
                    isPending={deleteMutation.isPending}
                  />
                ) : (
                  <AdminActionButton variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                    Delete
                  </AdminActionButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
