// Input validation utilities — pure functions, no side effects

/**
 * Validate a Solana base58 public key.
 * Base58 chars: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
 * Solana addresses are 32–44 characters long.
 */
export function isValidSolanaAddress(address: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength:
 * - Min 8 chars
 * - At least 1 uppercase
 * - At least 1 lowercase
 * - At least 1 digit
 */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
}

/**
 * Validate username format: 3–50 chars, alphanumeric + underscore.
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
}

/**
 * Validate that amount_requested ≤ 1.5 × estimated_cost.
 */
export function isAmountWithinEstimate(amountRequested: number, estimatedCost: number): boolean {
  return amountRequested <= estimatedCost * 1.5;
}

/**
 * Validate a positive numeric amount.
 */
export function isPositiveAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
