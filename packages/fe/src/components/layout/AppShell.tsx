import React from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}

export function AppShell({ children, hideBottomNav = false }: AppShellProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar />
      <main className={['flex-1', !hideBottomNav ? 'pb-20' : ''].filter(Boolean).join(' ')}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
