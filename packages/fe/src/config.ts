const apiUrl: string = import.meta.env.VITE_API_URL ?? '/api';

export const config = {
  apiUrl,
} as const;
