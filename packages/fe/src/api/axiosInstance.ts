// State: Shared Axios instance with auth interceptor
// Why here: Single HTTP client used by all API class instantiations; interceptors run
//           once for every outbound request and 401 response
// Updates: Token is read from localStorage on every request (interceptor runs per-request)

import axios, { AxiosError } from 'axios';
import { config } from '../config';

const axiosInstance = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from localStorage before every request
axiosInstance.interceptors.request.use((requestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    requestConfig.headers['Authorization'] = `Bearer ${token}`;
  }
  return requestConfig;
});

// Track whether we're currently refreshing to prevent loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once
    if (error.response?.status === 401 && originalRequest && !('_retry' in originalRequest)) {
      if (isRefreshing) {
        // Queue requests that arrive while a refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token as string}`;
          }
          return axiosInstance(originalRequest);
        });
      }

      (originalRequest as typeof originalRequest & { _retry: boolean })._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        processQueue(error, null);
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${config.apiUrl}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        processQueue(null, accessToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        const err =
          refreshError instanceof Error ? refreshError : new Error('Token refresh failed');
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
