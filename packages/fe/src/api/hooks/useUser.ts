import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { usersApi, authApi } from '../apiClient';
import type { UpdateUserDto, NotificationPreferencesDto } from 'api-client';

export function useUpdateUsername() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateUserDto) => {
      const res = await usersApi.updateMe(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async () => {
      const res = await authApi.resendVerification();
      return res.data;
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['users', 'me', 'notification-preferences'],
    queryFn: async () => {
      const res = await usersApi.getMe();
      // The BFF returns UserDto. We cast to unknown then to the target type
      // to access notification_preferences which exists on the object but might be missing from the generated type.
      const data = res.data as unknown as { notification_preferences: NotificationPreferencesDto };
      return data.notification_preferences;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: NotificationPreferencesDto) => {
      const res = await usersApi.updateNotificationPreferences(dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.auth.me });
      void qc.invalidateQueries({ queryKey: ['users', 'me', 'notification-preferences'] });
    },
  });
}
