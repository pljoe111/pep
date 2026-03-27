// Pure formatting utilities — no state, no side effects

/**
 * Format a number as USD currency string.
 * @example formatUSD(1234.56) → "$1,234.56"
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a crypto amount with currency label.
 * @example formatCrypto(1234.56, 'usdc') → "1,234.56 USDC"
 */
export function formatCrypto(amount: number, currency: 'usdc' | 'usdt'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
  return `${formatted} ${currency.toUpperCase()}`;
}

/**
 * Format a decimal as a percentage string.
 * @example formatPercent(73.4) → "73.4%"
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

/**
 * Format remaining seconds as human-readable time.
 * @example formatTimeRemaining(518400) → "6d 4h"
 * @example formatTimeRemaining(0) → "Expired"
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format an ISO date string as a short human-readable date.
 * @example formatDate("2025-06-12T00:00:00.000Z") → "Jun 12, 2025"
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Format an ISO date string as a relative time string.
 * @example formatRelativeDate("2025-06-12T10:00:00.000Z") → "2 hours ago"
 */
export function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(iso);
}

/**
 * Truncate a Solana base58 address to show first 4 and last 4 chars.
 * @example truncateAddress("SoL1na...base58x") → "SoL1…58x"
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
