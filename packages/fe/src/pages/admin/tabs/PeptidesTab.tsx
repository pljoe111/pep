import React, { useState } from 'react';
import type { PeptideDto } from 'api-client';
import { useAllPeptides, useRejectPeptide } from '../../../api/hooks/usePeptides';
import { useToast } from '../../../hooks/useToast';
import { Spinner } from '../../../components/ui/Spinner';
import { PeptideList } from '../components/peptides/PeptideList';
import { PeptideModal } from '../components/peptides/PeptideModal';
import { RejectPeptideModal } from '../components/peptides/RejectPeptideModal';

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

export function PeptidesTab(): React.ReactElement {
  const [showUnreviewed, setShowUnreviewed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<PeptideDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PeptideDto | null>(null);

  const { data, isLoading } = useAllPeptides(showUnreviewed);
  const rejectMutation = useRejectPeptide();
  const toast = useToast();

  const peptides: PeptideDto[] = data ?? [];

  const handleReject = (peptide: PeptideDto): void => {
    rejectMutation.mutate(peptide.id, {
      onSuccess: () => {
        toast.success(`${peptide.name} rejected`);
        setRejectTarget(null);
      },
      onError: (e: unknown) => toast.error(extractApiError(e, 'Failed to reject')),
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
          Add Peptide
        </button>
        <button
          type="button"
          onClick={() => setShowUnreviewed(!showUnreviewed)}
          className={[
            'px-3 py-2 rounded-full border text-sm font-medium min-h-[36px]',
            showUnreviewed
              ? 'bg-primary-l border-primary text-primary'
              : 'border-border text-text-2 hover:border-text-3',
          ].join(' ')}
        >
          Show Unreviewed
        </button>
      </div>

      <PeptideList
        peptides={peptides}
        onEdit={(p) => setEditTarget(p)}
        onReject={(p) => setRejectTarget(p)}
      />

      {showCreate && (
        <PeptideModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => {}} />
      )}

      {editTarget && (
        <PeptideModal
          mode="edit"
          peptide={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}

      {rejectTarget && (
        <RejectPeptideModal
          peptide={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={() => handleReject(rejectTarget)}
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  );
}
