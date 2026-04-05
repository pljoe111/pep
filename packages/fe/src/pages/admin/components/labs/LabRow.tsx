import React from 'react';
import type { LabDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { AdminStatusBadge } from '../shared/AdminStatusBadge';
import { AdminActionButton } from '../shared/AdminActionButton';
import { useApproveLab, useDeactivateLab, useReactivateLab } from '../../../../api/hooks/useLabs';
import { useToast } from '../../../../hooks/useToast';

interface LabRowProps {
  lab: LabDto;
  onEdit: (labId: string) => void;
  onDelete: (lab: LabDto) => void;
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

export function LabRow({ lab, onEdit, onDelete }: LabRowProps): React.ReactElement {
  const approveMutation = useApproveLab();
  const deactivateMutation = useDeactivateLab();
  const reactivateMutation = useReactivateLab();
  const toast = useToast();

  return (
    <Card padding="md" className={!lab.is_active ? 'opacity-60' : ''}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-text">{lab.name}</p>
          <p className="text-xs text-text-2">{lab.country}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge status={lab.is_approved ? 'approved' : 'pending'} />
          {!lab.is_active && <Badge variant="gray">Disabled</Badge>}
          <div className="flex flex-wrap gap-1.5">
            {lab.is_active && !lab.is_approved && (
              <AdminActionButton
                variant="primary"
                loading={approveMutation.isPending}
                onClick={() => {
                  approveMutation.mutate(lab.id, {
                    onSuccess: () => toast.success(`${lab.name} approved`),
                    onError: (e) => toast.error(extractApiError(e, 'Failed to approve')),
                  });
                }}
              >
                Approve
              </AdminActionButton>
            )}
            {lab.is_active && lab.is_approved && (
              <>
                <AdminActionButton variant="ghost" onClick={() => onEdit(lab.id)}>
                  Edit
                </AdminActionButton>
                <AdminActionButton
                  variant="ghost"
                  loading={deactivateMutation.isPending}
                  onClick={() => {
                    deactivateMutation.mutate(lab.id, {
                      onSuccess: () => toast.success(`${lab.name} disabled`),
                      onError: (e) => toast.error(extractApiError(e, 'Failed to disable')),
                    });
                  }}
                >
                  Disable
                </AdminActionButton>
              </>
            )}
            {!lab.is_active && (
              <>
                <AdminActionButton
                  variant="ghost"
                  loading={reactivateMutation.isPending}
                  onClick={() => {
                    reactivateMutation.mutate(lab.id, {
                      onSuccess: () => toast.success(`${lab.name} reactivated`),
                      onError: (e) => toast.error(extractApiError(e, 'Failed to reactivate')),
                    });
                  }}
                >
                  Reactivate
                </AdminActionButton>
                <AdminActionButton variant="danger" onClick={() => onDelete(lab)}>
                  Delete
                </AdminActionButton>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
