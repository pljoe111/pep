import { useQuery } from '@tanstack/react-query';
import { appInfoApi } from '../apiClient';
import { queryKeys } from '../queryKeys';

export function useAppInfo() {
  return useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: async () => {
      const res = await appInfoApi.getAppInfo();
      return res.data;
    },
  });
}
