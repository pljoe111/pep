import React, { useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
  onTabChange?: (id: string) => void;
}

export function Tabs({
  tabs,
  defaultTab,
  className = '',
  onTabChange,
}: TabsProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.id ?? '');

  const handleTabChange = (id: string): void => {
    setActiveTab(id);
    onTabChange?.(id);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={[
              'flex-shrink-0 px-4 py-3 text-sm font-semibold whitespace-nowrap',
              'border-b-2 transition-colors duration-150',
              'min-h-[44px]',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-2 hover:text-text',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="pt-4">{activeContent}</div>
    </div>
  );
}
