import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className = '',
}: PageContainerProps): React.ReactElement {
  return (
    <div className={['max-w-2xl mx-auto px-4 md:max-w-5xl', className].join(' ')}>{children}</div>
  );
}
