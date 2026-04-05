import React from 'react';
import type { VendorDto } from 'api-client';
import { Card } from '../../../../components/ui/Card';
import { AdminStatusBadge } from '../shared/AdminStatusBadge';
import { AdminActionButton } from '../shared/AdminActionButton';
import { useReviewVendor, useReinstateVendor } from '../../../../api/hooks/useVendors';
import { useToast } from '../../../../hooks/useToast';

interface VendorRowProps {
  vendor: VendorDto;
  onEdit: (v: VendorDto) => void;
  onReject: (v: VendorDto) => void;
  onSuspend: (v: VendorDto) => void;
  onDelete: (v: VendorDto) => void;
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

export function VendorRow({
  vendor,
  onEdit,
  onReject,
  onSuspend,
  onDelete,
}: VendorRowProps): React.ReactElement {
  const reviewMutation = useReviewVendor();
  const reinstateMutation = useReinstateVendor();
  const toast = useToast();

  return (
    <Card padding="sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text">{vendor.name}</p>
          <p className="text-xs text-text-2 mt-0.5">
            {vendor.website && <span>{vendor.website} · </span>}
            {vendor.country}
          </p>
          <p className="text-xs text-text-3 mt-0.5">
            Submitted by {vendor.submitted_by} · {new Date(vendor.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusBadge status={vendor.status} />
          <div className="flex flex-wrap gap-1.5">
            {vendor.status === 'pending' && (
              <>
                <AdminActionButton
                  variant="primary"
                  loading={reviewMutation.isPending}
                  onClick={() => {
                    reviewMutation.mutate(
                      { id: vendor.id, dto: { status: 'approved' } },
                      {
                        onSuccess: () => toast.success(`${vendor.name} approved`),
                        onError: (e: unknown) =>
                          toast.error(extractApiError(e, 'Failed to approve')),
                      }
                    );
                  }}
                >
                  Approve
                </AdminActionButton>
                <AdminActionButton variant="danger" onClick={() => onReject(vendor)}>
                  Reject
                </AdminActionButton>
              </>
            )}
            {vendor.status === 'approved' && (
              <>
                <AdminActionButton variant="ghost" onClick={() => onEdit(vendor)}>
                  Edit
                </AdminActionButton>
                <AdminActionButton variant="ghost" onClick={() => onSuspend(vendor)}>
                  Suspend
                </AdminActionButton>
              </>
            )}
            {vendor.status === 'rejected' && (
              <>
                <AdminActionButton
                  variant="ghost"
                  loading={reinstateMutation.isPending}
                  onClick={() => {
                    reinstateMutation.mutate(vendor.id, {
                      onSuccess: () => toast.success(`${vendor.name} reinstated`),
                      onError: (e: unknown) =>
                        toast.error(extractApiError(e, 'Failed to reinstate')),
                    });
                  }}
                >
                  Reinstate
                </AdminActionButton>
                <AdminActionButton variant="danger" onClick={() => onDelete(vendor)}>
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
