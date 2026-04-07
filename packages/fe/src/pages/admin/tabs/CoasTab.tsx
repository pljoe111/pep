import React, { useState } from 'react';
import type { AdminCoaDto } from 'api-client';
import { useAdminCoas, useAdminVerifyCoa, useAdminRunOcr } from '../../../api/hooks/useAdmin';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { AdminFilterBar } from '../components/shared/AdminFilterBar';
import { AdminEmptyState } from '../components/shared/AdminEmptyState';
import { AdminStatusBadge } from '../components/shared/AdminStatusBadge';
import { AdminActionButton } from '../components/shared/AdminActionButton';
import { CoaVerifyModal } from '../components/coas/CoaVerifyModal';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'OCR result: Code Found', value: 'code_found' },
  { label: 'OCR result: Code Not Found', value: 'code_not_found' },
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

export function CoasTab(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('');
  const [page] = useState(1);
  const [verifyModal, setVerifyModal] = useState<AdminCoaDto | null>(null);
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null);

  const { data, isLoading } = useAdminCoas({
    status: statusFilter || undefined,
    page,
  });

  const verifyMutation = useAdminVerifyCoa();
  const runOcrMutation = useAdminRunOcr();
  const toast = useToast();

  const coas: AdminCoaDto[] = data?.data ?? [];

  const handleVerify = (coa: AdminCoaDto): void => {
    setVerifyModal(coa);
  };

  const handleRunOcr = (id: string): void => {
    runOcrMutation.mutate(id, {
      onSuccess: () => toast.success('OCR job completed'),
      onError: (e) => toast.error(extractApiError(e, 'Failed to run OCR')),
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AdminFilterBar options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {coas.length === 0 ? (
        <AdminEmptyState message="No COAs found" />
      ) : (
        <div className="space-y-3">
          {coas.map((coa) => (
            <React.Fragment key={coa.id}>
              <div
                className={[
                  'bg-surface border border-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all',
                  expandedPdf === coa.id ? 'rounded-t-xl border-b-0' : 'rounded-xl',
                ].join(' ')}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/campaigns/${coa.campaign_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-primary hover:underline truncate"
                    >
                      {coa.campaign_title}
                    </a>
                    <AdminStatusBadge status={coa.verification_status} />
                    {coa.rejection_count >= 3 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-danger border border-red-200">
                        ⚠ 3/3 — auto-refunded
                      </span>
                    )}
                    {coa.rejection_count === 2 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-warning border border-amber-200">
                        ⚠ 2/3 rejections
                      </span>
                    )}
                    {coa.rejection_count === 1 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-warning border border-amber-200">
                        1/3 rejections
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 text-sm text-text-2 flex-wrap">
                    <span>
                      Code:{' '}
                      <span className="font-mono font-medium text-primary">
                        {coa.campaign_verification_code}
                      </span>
                    </span>
                    <span>Label: {coa.sample_label}</span>
                    <span>Uploaded: {new Date(coa.uploaded_at).toLocaleDateString()}</span>
                    <span>
                      Creator:{' '}
                      <a
                        href={`/admin?tab=users&search=${encodeURIComponent(coa.creator_email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {coa.creator_username ?? coa.creator_email}
                      </a>
                    </span>
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 text-sm text-text-2 flex-wrap">
                    <span>
                      Lab: <span className="text-text font-medium">{coa.lab_name}</span>
                    </span>
                    <span>
                      Tests:{' '}
                      <span className="text-text font-medium">{coa.test_names.join(', ')}</span>
                    </span>
                    {coa.sample_mass && (
                      <span>
                        Mass: <span className="text-text font-medium">{coa.sample_mass}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandedPdf(expandedPdf === coa.id ? null : coa.id)}
                    className={[
                      'px-3 py-2 rounded-xl border text-sm font-medium transition-colors min-h-[44px] flex items-center',
                      expandedPdf === coa.id
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-text-2 hover:border-text-3 hover:text-text',
                    ].join(' ')}
                  >
                    {expandedPdf === coa.id ? 'Close PDF' : 'View PDF'}
                  </button>
                  <AdminActionButton
                    onClick={() => handleRunOcr(coa.id)}
                    loading={runOcrMutation.isPending && runOcrMutation.variables === coa.id}
                  >
                    Run OCR
                  </AdminActionButton>
                  <AdminActionButton variant="primary" onClick={() => handleVerify(coa)}>
                    Verify
                  </AdminActionButton>
                </div>
              </div>
              {expandedPdf === coa.id && (
                <div className="bg-surface-a border-x border-b border-border rounded-b-xl -mt-3 mb-3 p-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="aspect-[4/3] w-full bg-white rounded-lg border border-border overflow-hidden">
                    <iframe
                      src={`${coa.file_url}#toolbar=0`}
                      className="w-full h-full"
                      title={`COA PDF for ${coa.campaign_title}`}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <a
                      href={coa.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {verifyModal && (
        <CoaVerifyModal
          coa={verifyModal}
          onClose={() => setVerifyModal(null)}
          onConfirm={(status, notes) => {
            verifyMutation.mutate(
              { id: verifyModal.id, dto: { status, notes } },
              {
                onSuccess: () => {
                  toast.success(`COA ${status}`);
                  setVerifyModal(null);
                },
                onError: (e) => toast.error(extractApiError(e, 'Failed to verify COA')),
              }
            );
          }}
          isPending={verifyMutation.isPending}
        />
      )}
    </div>
  );
}
