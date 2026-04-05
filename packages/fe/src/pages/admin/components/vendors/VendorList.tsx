import React from 'react';
import type { VendorDto } from 'api-client';
import { AdminEmptyState } from '../shared/AdminEmptyState';
import { VendorRow } from './VendorRow';

interface VendorListProps {
  vendors: VendorDto[];
  onEdit: (v: VendorDto) => void;
  onReject: (v: VendorDto) => void;
  onSuspend: (v: VendorDto) => void;
  onDelete: (v: VendorDto) => void;
}

export function VendorList({
  vendors,
  onEdit,
  onReject,
  onSuspend,
  onDelete,
}: VendorListProps): React.ReactElement {
  if (vendors.length === 0) {
    return <AdminEmptyState message="No vendors found" />;
  }

  return (
    <div className="space-y-3">
      {vendors.map((v) => (
        <VendorRow
          key={v.id}
          vendor={v}
          onEdit={onEdit}
          onReject={onReject}
          onSuspend={onSuspend}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
