import React, { useState, useEffect } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { NotificationItem } from './NotificationItem';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
} from '../../api/hooks/useNotifications';
import { NotificationDto } from 'api-client';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [page, setPage] = useState(1);
  const [allNotifications, setAllNotifications] = useState<NotificationDto[]>([]);

  const { data: notifications, isLoading, isFetching } = useNotifications(page);
  const { data: unreadData } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Append new notifications when page changes
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      if (page === 1) {
        setAllNotifications(notifications);
      } else {
        setAllNotifications((prev) => {
          // Filter out duplicates just in case
          const existingIds = new Set(prev.map((n) => n.id));
          const newItems = notifications.filter((n) => !existingIds.has(n.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [notifications, page]);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setPage(1);
    }
  }, [isOpen]);

  const handleMarkAllRead = () => {
    void markAllRead.mutateAsync();
  };

  const handleRead = (id: string) => {
    void markRead.mutateAsync({ id });
    onClose();
  };

  const hasNextPage = notifications && notifications.length > 0; // Simple check for now

  const title = unreadData?.count ? `Notifications (${unreadData.count})` : 'Notifications';

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending || allNotifications.length === 0}
          >
            Mark all as read
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-border -mx-5">
          {allNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={handleRead}
            />
          ))}

          {isLoading && page === 1 && (
            <div className="flex flex-col gap-4 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex flex-col gap-2">
                  <div className="h-4 bg-border rounded w-3/4" />
                  <div className="h-3 bg-border rounded w-full" />
                  <div className="h-3 bg-border rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && allNotifications.length === 0 && (
            <div className="py-10">
              <EmptyState heading="No notifications yet" />
            </div>
          )}
        </div>

        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              loading={isFetching}
              disabled={isFetching}
              fullWidth
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
};
