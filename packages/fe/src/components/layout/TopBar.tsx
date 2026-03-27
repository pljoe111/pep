import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar';
import { queryKeys } from '../../api/queryKeys';
import { notificationsApi } from '../../api/apiClient';
import { useAuth } from '../../hooks/useAuth';

function BellIcon({ count }: { count: number }): React.ReactElement {
  return (
    <div className="relative">
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  );
}

export function TopBar(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  const { data: unreadData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const res = await notificationsApi.getUnreadCount();
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000, // Poll every 30 seconds
    staleTime: 15_000,
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-2xl mx-auto px-4 md:max-w-5xl flex items-center justify-between h-14">
        {/* Logo / Brand */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <span
            aria-hidden="true"
            className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm"
          >
            PL
          </span>
          <span>PepLab</span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="p-2 rounded-xl text-text-2 hover:bg-surface-a transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <BellIcon count={unreadCount} />
              </button>
              <Link
                to="/account"
                className="flex items-center min-h-[44px] min-w-[44px] justify-center"
                aria-label="Account"
              >
                <Avatar username={user?.username ?? user?.email?.split('@')[0]} size="sm" />
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold min-h-[44px] flex items-center"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
