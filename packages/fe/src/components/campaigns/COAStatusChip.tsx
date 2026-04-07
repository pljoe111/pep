import React from 'react';
import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import type { VerificationStatus } from 'api-client';

interface COAStatusChipProps {
  status: VerificationStatus | null; // null = not yet uploaded
  rejectionCount?: number; // shown when status === 'rejected'
  className?: string;
}

const STATUS_CONFIG = {
  null: {
    icon: Clock,
    variant: 'bg-stone-100 text-stone-600',
    label: 'Awaiting Upload',
  },
  pending: {
    icon: Clock,
    variant: 'bg-stone-100 text-stone-600',
    label: 'Pending Review',
  },
  code_found: {
    icon: CheckCircle,
    variant: 'bg-teal-100 text-teal-800',
    label: 'OCR: Code Found',
  },
  code_not_found: {
    icon: AlertCircle,
    variant: 'bg-amber-100 text-amber-800',
    label: 'OCR: Code Not Found',
  },
  manually_approved: {
    icon: CheckCircle,
    variant: 'bg-emerald-100 text-emerald-800',
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    variant: 'bg-red-100 text-red-800',
    label: 'Rejected',
  },
} as const;

export function COAStatusChip({
  status,
  rejectionCount,
  className = '',
}: COAStatusChipProps): React.ReactElement {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.null;
  const Icon = config.icon;

  let label: string = config.label;
  if (status === 'rejected' && rejectionCount !== undefined) {
    label = `${config.label} (${rejectionCount}/3)`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.variant} ${className}`}
    >
      <Icon size={14} strokeWidth={2} />
      {label}
    </span>
  );
}
