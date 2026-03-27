// State: TanStack Query global client configuration
// Why here: Single instance shared across the entire app via QueryClientProvider in main.tsx
// Updates: Created once; never mutated at runtime

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute default; overridden per-query where needed
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
