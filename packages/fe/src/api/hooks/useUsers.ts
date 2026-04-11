import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../apiClient';
import { queryKeys } from '../queryKeys';
import type { PublicUserProfileDto } from 'api-client';

export function usePublicProfile(userId: string) {
  return useQuery<PublicUserProfileDto>({
    queryKey: queryKeys.users.profile(userId),
    queryKeyHashFn: (key) => JSON.stringify(key),
    queryFn: async () => {
      const response = await usersApi.getPublicProfile(userId);
      return response.data;
    },
    enabled: !!userId,
  });
}
