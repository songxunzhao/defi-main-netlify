import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../utils/api';
import { Property } from '../utils/types';

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const data = await apiFetch<{ properties: Property[] }>('/api/properties');
      return data.properties;
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      const data = await apiFetch<{ property: Property }>(`/api/properties/${id}`);
      return data.property;
    },
    enabled: Boolean(id),
  });
}
