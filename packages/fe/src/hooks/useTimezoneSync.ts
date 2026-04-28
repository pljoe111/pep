/**
 * useTimezoneSync
 *
 * Detects the user's current IANA timezone via the Intl API and, if it
 * differs from the last-synced value stored in localStorage, silently
 * PATCHes the BFF so the server always has the up-to-date timezone.
 *
 * Runs once on mount. Failures are swallowed — the UI must never break
 * because of a background timezone sync.
 */

import { useEffect } from 'react';
import type { AxiosInstance } from 'axios';
import axiosInstance from '../api/axiosInstance';

const KEY_SYNCED_TZ = 'peplab_synced_timezone';

export function useTimezoneSync(): void {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected) return;

    const synced = localStorage.getItem(KEY_SYNCED_TZ);
    if (synced === detected) return;

    const client: AxiosInstance = axiosInstance;

    void client
      .patch<unknown>('/users/me', { timezone: detected })
      .then(() => {
        localStorage.setItem(KEY_SYNCED_TZ, detected);
      })
      .catch(() => {
        // intentionally silent
      });
  }, []);
}
