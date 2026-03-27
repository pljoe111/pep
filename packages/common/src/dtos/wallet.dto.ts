import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

// ─── String literal types mirroring Prisma enums ─────────────────────────────

export type Currency = 'usdc' | 'usdt';
export type AccountType = 'user' | 'campaign' | 'master' | 'fee' | 'external';
export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'contribution'
  | 'refund'
  | 'payout'
  | 'fee';
export type TxStatus = 'completed' | 'pending' | 'confirmed' | 'failed';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class WithdrawDto {
  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @IsEnum(['usdc', 'usdt'] as const)
  currency!: Currency;

  @IsString()
  @IsNotEmpty()
  destination_address!: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface WalletBalanceDto {
  balance_usdc: number;
  balance_usdt: number;
}

export interface DepositAddressDto {
  /** Base58 Solana public key */
  address: string;
  /** solana:{address} URI for QR code generation */
  qr_hint: string;
}

export interface WithdrawResponseDto {
  ledger_transaction_id: string;
  status: 'pending';
}

export interface LedgerTransactionDto {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  currency: Currency;
  from_account_type: AccountType;
  to_account_type: AccountType;
  status: TxStatus;
  onchain_signature: string | null;
  created_at: string;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
