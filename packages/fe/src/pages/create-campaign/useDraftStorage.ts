// src/pages/create-campaign/useDraftStorage.ts
import { WizardFormState, WIZARD_DRAFT_KEY } from './types';

export function useDraftStorage() {
  function loadDraft(): WizardFormState | null {
    try {
      const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as WizardFormState) : null;
    } catch {
      return null;
    }
  }

  function saveDraft(state: WizardFormState): void {
    localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(state));
  }

  function clearDraft(): void {
    localStorage.removeItem(WIZARD_DRAFT_KEY);
  }

  return { loadDraft, saveDraft, clearDraft };
}
