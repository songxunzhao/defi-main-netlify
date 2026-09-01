import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchActivity, syncActivity } from '../utils/api';

export function useActivity(enabled: boolean) {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    enabled,
  });
}

export function useSyncActivity() {
  const queryClient = useQueryClient();
  return async () => {
    const result = await syncActivity();
    await queryClient.invalidateQueries({ queryKey: ['activity'] });
    return result;
  };
}
