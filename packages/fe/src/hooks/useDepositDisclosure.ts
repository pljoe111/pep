/**
 * useDepositDisclosure
 *
 * Manages the deposit market-rate disclosure state in localStorage.
 *
 * Storage keys:
 *   peplab_deposit_disclosure_do_not_show  — "true" if user checked "do not show again"
 *   peplab_deposit_disclosure_first_at     — ISO string of first acceptance timestamp
 *   peplab_deposit_disclosure_last_date    — YYYY-MM-DD (local) of most-recent acceptance
 */

import { useState, useCallback } from 'react';

const KEY_DO_NOT_SHOW = 'peplab_deposit_disclosure_do_not_show';
const KEY_FIRST_AT = 'peplab_deposit_disclosure_first_at';
const KEY_LAST_DATE = 'peplab_deposit_disclosure_last_date';

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
function localToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readBool(key: string): boolean {
  return localStorage.getItem(key) === 'true';
}

function readString(key: string): string | null {
  return localStorage.getItem(key);
}

export interface DepositDisclosureState {
  /** Whether the overlay should currently be shown. */
  shouldShow: boolean;
  /** Whether the "do not show again" checkbox is currently ticked. */
  doNotShowAgain: boolean;
  /** Toggle the checkbox value (does not persist until accept is called). */
  setDoNotShowAgain: (v: boolean) => void;
  /** Call when the user clicks Accept. Persists the preference. */
  accept: () => void;
  /** ISO timestamp of first acceptance, or null if never accepted. */
  firstAcceptedAt: string | null;
}

export function useDepositDisclosure(): DepositDisclosureState {
  const doNotShowStored = readBool(KEY_DO_NOT_SHOW);
  const lastDate = readString(KEY_LAST_DATE);
  const today = localToday();

  // Show if:
  //  - user never accepted (no lastDate), OR
  //  - user accepted on a previous calendar day AND did not check "do not show again"
  const initialShouldShow = !doNotShowStored && lastDate !== today;

  const [shouldShow, setShouldShow] = useState(initialShouldShow);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [firstAcceptedAt, setFirstAcceptedAt] = useState<string | null>(readString(KEY_FIRST_AT));

  const accept = useCallback(() => {
    const now = new Date().toISOString();

    // Record first acceptance timestamp (write-once)
    if (readString(KEY_FIRST_AT) === null) {
      localStorage.setItem(KEY_FIRST_AT, now);
      setFirstAcceptedAt(now);
    }

    // Record today's date for the daily reset logic
    localStorage.setItem(KEY_LAST_DATE, localToday());

    // Persist "do not show again" choice
    if (doNotShowAgain) {
      localStorage.setItem(KEY_DO_NOT_SHOW, 'true');
    }

    setShouldShow(false);
  }, [doNotShowAgain]);

  return { shouldShow, doNotShowAgain, setDoNotShowAgain, accept, firstAcceptedAt };
}
