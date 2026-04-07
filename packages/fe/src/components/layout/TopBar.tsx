import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadNotificationCount } from '../../api/hooks/useNotifications';
import { NotificationCenter } from '../notifications/NotificationCenter';

export const TopBar: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const { data: unreadData } = useUnreadNotificationCount();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-primary">PepLab</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => setIsNotifOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-text-2 transition-colors hover:bg-surface-a"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => void logout()}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-text-2 transition-colors hover:bg-surface-a"
                aria-label="Logout"
              >
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-d"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </header>
  );
};
