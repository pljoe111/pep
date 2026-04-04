import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar';
import { queryKeys } from '../../api/queryKeys';
import { notificationsApi, appInfoApi } from '../../api/apiClient';
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

/** Maps Solana network name → label + Tailwind classes */
function networkStyle(network: string): { label: string; className: string } {
  switch (network) {
    case 'mainnet-beta':
      return {
        label: '🟢 Mainnet',
        className:
          'bg-green-100 text-black-800 border border-green-300 dark:bg-green-900/30 dark:text-black-300',
      };
    case 'devnet':
      return {
        label: '🟡 Devnet',
        className:
          'bg-amber-100 text-black-800 border border-amber-300 dark:bg-amber-900/30 dark:text-black-300',
      };
    case 'testnet':
      return {
        label: '🔵 Testnet',
        className:
          'bg-blue-100 text-black-800 border border-blue-300 dark:bg-blue-900/30 dark:text-black-300',
      };
    default:
      return {
        label: `⚪ ${network}`,
        className: 'bg-stone-100 text-stone-600 border border-stone-300',
      };
  }
}

function NetworkBadge(): React.ReactElement | null {
  const { data: appInfo } = useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: async () => {
      const res = await appInfoApi.getAppInfo();
      return res.data;
    },
    staleTime: Infinity, // Network never changes at runtime
  });

  if (!appInfo) return null;

  const { label, className } = networkStyle(appInfo.network);

  return (
    <span
      className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${className}`}
      title={`Solana network: ${appInfo.network}`}
    >
      {label}
    </span>
  );
}

function AvatarMenu({
  username,
  email,
  isAdmin,
}: {
  username?: string | null;
  email?: string;
  isAdmin: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center min-h-[44px] min-w-[44px] justify-center rounded-xl hover:bg-surface-a transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar username={username ?? email?.split('@')[0]} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <Link
            to="/account"
            className="flex items-center gap-2 px-4 py-3 text-sm text-text hover:bg-surface-a transition-colors min-h-[44px]"
            onClick={() => setOpen(false)}
          >
            <svg
              className="w-4 h-4 text-text-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Profile
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-semibold hover:bg-primary-l transition-colors min-h-[44px] border-t border-border"
              onClick={() => setOpen(false)}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Admin Panel
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  const isAdmin = isAuthenticated && (user?.claims ?? []).includes('admin');

  const { data: unreadData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const res = await notificationsApi.getUnreadCount();
      return res.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-2xl mx-auto px-4 md:max-w-5xl flex items-center justify-between h-14">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <span
              aria-hidden="true"
              className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm"
            >
              PL
            </span>
            <span>PepLab</span>
          </Link>
          <NetworkBadge />
        </div>

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
              <AvatarMenu username={user?.username} email={user?.email} isAdmin={isAdmin} />
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
