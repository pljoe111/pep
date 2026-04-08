// src/pages/create-campaign/types.ts

export interface SampleForm {
  id: string; // local uuid (not from server)
  peptideId: string;
  peptideName: string;
  vendorId: string;
  vendorName: string;
  purchaseDate: string; // ISO date string
  physicalDescription: string;
  label: string;
  targetLabId: string;
  targetLabName: string;
  selectedTestIds: string[];
  claims: ClaimForm[];
}

export interface ClaimForm {
  id: string; // local uuid
  testId: string | null; // null = custom claim
  type: string;
  label: string;
  value: string;
  required: boolean;
}

export interface WizardFormState {
  // Step 1
  title: string;
  description: string;
  amountRequested: string; // string so empty input works; parse to number on submit
  fundingThresholdPercent: number; // 5–100
  // Step 2
  samples: SampleForm[];
  // Step 3 — no extra fields; review reads from above
}

export const WIZARD_DRAFT_KEY = 'peplab_campaign_draft_v2';

export const DEFAULT_FORM_STATE: WizardFormState = {
  title: '',
  description: '',
  amountRequested: '',
  fundingThresholdPercent: 70,
  samples: [],
};
