import React from 'react';
import { Button } from '../../../../components/ui/Button';

interface AdminActionButtonProps {
  variant?: 'ghost' | 'danger' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AdminActionButton({
  variant = 'ghost',
  size = 'sm',
  onClick,
  loading = false,
  disabled = false,
  children,
  className,
}: AdminActionButtonProps): React.ReactElement {
  return (
    <Button
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}
