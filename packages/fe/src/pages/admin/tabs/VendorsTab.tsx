import React, { useState } from 'react';
import type { VendorDto } from 'api-client';
import { useAllVendors, useReviewVendor, useDeleteVendor } from '../../../api/hooks/useVendors';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminFilterBar } from '../components/shared/AdminFilterBar';
import { AdminConfirmModal } from '../components/shared/AdminConfirmModal';
import { VendorList } from '../components/vendors/VendorList';
import { VendorModal } from '../components/vendors/VendorModal';
import { RejectVendorModal } from '../components/vendors/RejectVendorModal';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

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

export function VendorsTab(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<VendorDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VendorDto | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<VendorDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorDto | null>(null);

  const { data, isLoading } = useAllVendors(
    (statusFilter || undefined) as 'pending' | 'approved' | 'rejected' | undefined
  );
  const reviewMutation = useReviewVendor();
  const deleteMutation = useDeleteVendor();
  const toast = useToast();

  const vendors: VendorDto[] = data ?? [];

  const handleSuspend = (): void => {
    if (!suspendTarget) return;
    reviewMutation.mutate(
      { id: suspendTarget.id, dto: { status: 'rejected' } },
      {
        onSuccess: () => {
          toast.success(`${suspendTarget.name} suspended`);
          setSuspendTarget(null);
        },
        onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to suspend')),
      }
    );
  };

  const handleDelete = (): void => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
      },
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to delete')),
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium min-h-[44px]"
        >
          Add Vendor
        </button>
      </div>
      <AdminFilterBar options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />

      <VendorList
        vendors={vendors}
        onEdit={(v) => setEditTarget(v)}
        onReject={(v) => setRejectTarget(v)}
        onSuspend={(v) => setSuspendTarget(v)}
        onDelete={(v) => setDeleteTarget(v)}
      />

      {showCreate && (
        <VendorModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => {}} />
      )}

      {editTarget && (
        <VendorModal
          mode="edit"
          vendor={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}

      {rejectTarget && (
        <RejectVendorModal
          vendor={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(notes) => {
            reviewMutation.mutate(
              { id: rejectTarget.id, dto: { status: 'rejected', review_notes: notes } },
              {
                onSuccess: () => {
                  toast.success(`${rejectTarget.name} rejected`);
                  setRejectTarget(null);
                },
                onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to reject')),
              }
            );
          }}
          isPending={reviewMutation.isPending}
        />
      )}

      {suspendTarget && (
        <AdminConfirmModal
          title="Suspend Vendor"
          body={
            <p className="text-sm text-text">
              Suspending <strong>{suspendTarget.name}</strong> will mark them as rejected. Campaigns
              using this vendor are not affected.
            </p>
          }
          confirmLabel="Suspend"
          confirmVariant="danger"
          onConfirm={handleSuspend}
          onClose={() => setSuspendTarget(null)}
          isPending={reviewMutation.isPending}
        />
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete Vendor"
          body={
            <p className="text-sm text-text">
              Delete <strong>{deleteTarget.name}</strong> permanently?
            </p>
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
