import React from 'react';
import { Badge } from '../../../../components/ui/Badge';
import type { BadgeVariant } from '../../../../lib/badgeUtils';

interface AdminStatusBadgeProps {
  status: string;
}

export function AdminStatusBadge({ status }: AdminStatusBadgeProps): React.ReactElement {
  const variantMap: Record<string, BadgeVariant> = {
    approved: 'green',
    pending: 'amber',
    rejected: 'red',
    active: 'teal',
    disabled: 'gray',
    unreviewed: 'amber',
    flagged: 'amber',
    hidden: 'gray',
    banned: 'red',
    unverified: 'amber',
    verified: 'green',
    code_found: 'green',
    code_not_found: 'red',
  };

  const labelMap: Record<string, string> = {
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    active: 'Active',
    disabled: 'Disabled',
    unreviewed: 'Unreviewed',
    flagged: '⚑ Flagged',
    hidden: 'Hidden',
    banned: 'Banned',
    unverified: 'Unverified',
    verified: 'Email Verified',
    code_found: 'OCR result: Code Found',
    code_not_found: 'OCR result: Code Not Found',
  };

  const variant: BadgeVariant = variantMap[status] ?? 'gray';
  const label = labelMap[status] ?? status;

  return <Badge variant={variant}>{label}</Badge>;
}
