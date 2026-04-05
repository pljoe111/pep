import React from 'react';

interface AdminSectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function AdminSectionHeader({ title, action }: AdminSectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-bold text-text">{title}</h3>
      {action}
    </div>
  );
}
