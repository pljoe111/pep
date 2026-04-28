// src/pages/create-campaign/useDraftStorage.ts
import { useCallback } from 'react';
import { WizardFormState, WIZARD_DRAFT_KEY } from './types';

export function useDraftStorage() {
  const loadDraft = useCallback((): WizardFormState | null => {
    try {
      const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as WizardFormState) : null;
    } catch {
      return null;
    }
  }, []);

  const saveDraft = useCallback((state: WizardFormState): void => {
    localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(state));
  }, []);

  const clearDraft = useCallback((): void => {
    localStorage.removeItem(WIZARD_DRAFT_KEY);
  }, []);

  return { loadDraft, saveDraft, clearDraft };
}
