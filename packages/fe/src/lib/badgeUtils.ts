// Badge utility functions — pure mappings, no React components
import type { CampaignStatus, Currency } from 'api-client';

export type BadgeVariant =
  | 'amber'
  | 'blue'
  | 'purple'
  | 'indigo'
  | 'green'
  | 'red'
  | 'gray'
  | 'teal';

export type VerificationStatusType =
  | 'pending'
  | 'code_found'
  | 'code_not_found'
  | 'manually_approved'
  | 'rejected';

/** Map CampaignStatus to a Badge variant */
export function campaignStatusVariant(status: CampaignStatus): BadgeVariant {
  const map: Record<CampaignStatus, BadgeVariant> = {
    created: 'amber',
    funded: 'blue',
    samples_sent: 'purple',
    results_published: 'indigo',
    resolved: 'green',
    refunded: 'red',
  };
  return map[status];
}

/** Map CampaignStatus to a human-readable label */
export function campaignStatusLabel(status: CampaignStatus): string {
  const map: Record<CampaignStatus, string> = {
    created: 'Open',
    funded: 'Funded',
    samples_sent: 'Samples Sent',
    results_published: 'Results Published',
    resolved: 'Resolved',
    refunded: 'Refunded',
  };
  return map[status];
}

/** Map VerificationStatus to a Badge variant */
export function verificationStatusVariant(status: VerificationStatusType): BadgeVariant {
  const map: Record<VerificationStatusType, BadgeVariant> = {
    pending: 'gray',
    code_found: 'green',
    code_not_found: 'amber',
    manually_approved: 'green',
    rejected: 'red',
  };
  return map[status];
}

export function verificationStatusLabel(status: VerificationStatusType): string {
  const map: Record<VerificationStatusType, string> = {
    pending: 'Pending',
    code_found: 'Code Found',
    code_not_found: 'Code Not Found',
    manually_approved: 'Approved',
    rejected: 'Rejected',
  };
  return map[status];
}

/** Map Currency to a human-readable display label. */
export function currencyLabel(currency: Currency): string {
  const map: Record<Currency, string> = {
    usdc: 'USDC',
    usdt: 'USDT',
    pyusd: 'PYUSD',
  };
  return map[currency] ?? currency.toUpperCase();
}

/** Map Currency to a Badge variant for use in transaction history. */
export function currencyVariant(currency: Currency): BadgeVariant {
  const map: Record<Currency, BadgeVariant> = {
    usdc: 'blue',
    usdt: 'teal',
    pyusd: 'indigo',
  };
  return map[currency] ?? 'gray';
}
