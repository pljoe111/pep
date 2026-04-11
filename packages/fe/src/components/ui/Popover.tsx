import React, { useEffect, useRef } from 'react';

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Popover({
  isOpen,
  onClose,
  children,
  className = '',
}: PopoverProps): React.ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={[
        'absolute right-0 top-full mt-2 z-50 w-80 max-h-[80vh] overflow-y-auto',
        'bg-surface rounded-2xl shadow-xl border border-border',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        className,
      ].join(' ')}
    >
      <div className="p-5">{children}</div>
    </div>
  );
}
