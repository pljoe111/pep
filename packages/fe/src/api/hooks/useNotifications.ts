import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../apiClient';
import { queryKeys } from '../queryKeys';
import { NotificationDto } from 'api-client';

/**
 * Hook to fetch a paginated list of notifications
 */
export function useNotifications(page: number) {
  return useQuery({
    queryKey: queryKeys.notifications.list(page),
    queryFn: async (): Promise<NotificationDto[]> => {
      const response = await notificationsApi.getAllNotifications(page);
      return response.data.data;
    },
  });
}

/**
 * Hook to fetch the unread notification count, polled every 30 seconds
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async (): Promise<{ count: number }> => {
      const response = await notificationsApi.getUnreadCount();
      return response.data;
    },
    refetchInterval: 30_000,
  });
}

/**
 * Hook to mark a single notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await notificationsApi.markRead(id);
    },
    onSuccess: async () => {
      // Invalidate both the list (reset to page 1) and the unread count
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await notificationsApi.markAllRead();
    },
    onSuccess: async () => {
      // Invalidate both the list (reset to page 1) and the unread count
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(1) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
  });
}
