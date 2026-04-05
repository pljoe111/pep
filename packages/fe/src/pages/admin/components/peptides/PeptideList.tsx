import React from 'react';
import type { PeptideDto } from 'api-client';
import { AdminEmptyState } from '../shared/AdminEmptyState';
import { PeptideRow } from './PeptideRow';

interface PeptideListProps {
  peptides: PeptideDto[];
  onEdit: (p: PeptideDto) => void;
  onReject: (p: PeptideDto) => void;
}

export function PeptideList({ peptides, onEdit, onReject }: PeptideListProps): React.ReactElement {
  if (peptides.length === 0) {
    return <AdminEmptyState message="No peptides found" />;
  }

  return (
    <div className="space-y-3">
      {peptides.map((p) => (
        <PeptideRow key={p.id} peptide={p} onEdit={onEdit} onReject={onReject} />
      ))}
    </div>
  );
}
