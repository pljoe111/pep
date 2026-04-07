import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationDto } from 'api-client';
import { formatRelativeDate } from '../../lib/formatters';

interface NotificationItemProps {
  notification: NotificationDto;
  onRead: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    onRead(notification.id);
    if (notification.campaign_id) {
      void navigate(`/campaigns/${notification.campaign_id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors min-h-[44px] ${
        notification.is_read ? 'bg-bg' : 'bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {!notification.is_read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          )}
          <h4 className="truncate text-sm font-medium text-text">{notification.title}</h4>
        </div>
        <span className="shrink-0 text-xs text-text-3">
          {formatRelativeDate(notification.created_at)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-text-2">{notification.message}</p>
    </button>
  );
};
