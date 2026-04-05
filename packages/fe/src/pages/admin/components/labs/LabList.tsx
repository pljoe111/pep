import React from 'react';
import type { LabDto } from 'api-client';
import { AdminEmptyState } from '../shared/AdminEmptyState';
import { LabRow } from './LabRow';

interface LabListProps {
  labs: LabDto[];
  onEdit: (labId: string) => void;
  onDelete: (lab: LabDto) => void;
}

export function LabList({ labs, onEdit, onDelete }: LabListProps): React.ReactElement {
  if (labs.length === 0) {
    return <AdminEmptyState message="No labs found" />;
  }

  return (
    <div className="space-y-3">
      {labs.map((lab) => (
        <LabRow key={lab.id} lab={lab} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
