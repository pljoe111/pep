import React, { useEffect } from 'react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: SheetProps): React.ReactElement | null {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet panel — full width on mobile, max-w modal on md+ */}
      <div
        className={[
          'relative z-10 w-full bg-surface',
          'md:rounded-2xl md:max-w-lg md:shadow-xl',
          'rounded-t-3xl shadow-2xl',
          'max-h-[92vh] md:max-h-[90vh] overflow-y-auto',
          'animate-[slideUp_200ms_ease-out]',
          className,
        ].join(' ')}
        style={{
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {/* Handle bar — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-border">
            <h2 id="sheet-title" className="text-xl font-bold text-text">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-text-2 hover:bg-surface-a transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5 pb-[env(safe-area-inset-bottom,20px)]">{children}</div>
      </div>
    </div>
  );
}
