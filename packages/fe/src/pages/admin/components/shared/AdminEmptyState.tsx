import React from 'react';
import { EmptyState } from '../../../../components/ui/EmptyState';

interface AdminEmptyStateProps {
  message?: string;
}

export function AdminEmptyState({ message }: AdminEmptyStateProps): React.ReactElement {
  return <EmptyState heading={message ?? 'Nothing here yet'} />;
}
