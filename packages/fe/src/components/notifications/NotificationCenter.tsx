import React from 'react';
import { Sheet } from '../ui/Sheet';
import { Popover } from '../ui/Popover';
import { NotificationList } from './NotificationList';
import { useUnreadNotificationCount } from '../../api/hooks/useNotifications';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  variant: 'mobile' | 'desktop';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  variant,
}) => {
  const { data: unreadData } = useUnreadNotificationCount();
  const title = unreadData?.count ? `Notifications (${unreadData.count})` : 'Notifications';

  if (variant === 'mobile') {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} title={title} side="top">
        <NotificationList onClose={onClose} />
      </Sheet>
    );
  }

  return (
    <Popover isOpen={isOpen} onClose={onClose}>
      <NotificationList onClose={onClose} />
    </Popover>
  );
};
