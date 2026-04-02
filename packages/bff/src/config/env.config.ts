/**
 * All environment variables are declared and validated here using envalid.
 * Direct `process.env.*` access anywhere else in src/ is FORBIDDEN (coding rules §8.1).
 *
 * Variables match spec §11 exactly.
 */
import { cleanEnv, str, num, bool } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const env = cleanEnv(process.env, {
  // ─── App ───────────────────────────────────────────────────────────────────
  NODE_ENV: str({
    choices: ['development', 'production', 'test'],
    default: 'development',
  }),
  PORT: num({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),
  APP_URL: str({ default: 'http://localhost:3000' }),
  FRONTEND_URL: str({ default: 'http://localhost:5173' }),
  APP_VERSION: str({ default: '1.0.0' }),
  CORS_ORIGIN: str({ default: 'http://localhost:5173' }),
  ENABLE_SWAGGER: bool({ default: true }),

  // ─── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: str(),

  // ─── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: str({ default: 'redis://localhost:6379' }),

  // ─── JWT ───────────────────────────────────────────────────────────────────
  /** Min 32 char random string */
  JWT_SECRET: str(),
  /** Kept for legacy; not used for signing — refresh tokens are random */
  JWT_REFRESH_SECRET: str({ default: '' }),

  // ─── Solana ────────────────────────────────────────────────────────────────
  SOLANA_NETWORK: str({
    choices: ['devnet', 'mainnet-beta', 'testnet'],
    default: 'devnet',
  }),
  SOLANA_RPC_URL: str({ default: 'https://api.devnet.solana.com' }),
  USDC_MINT: str(),
  USDT_MINT: str(),
  MASTER_WALLET_PUBLIC_KEY: str(),
  /**
   * SECURITY: This key must NEVER be logged or returned by any API.
   * Access restricted to: withdrawal.worker.ts and solana.service.ts ONLY.
   * Coding rules §8.3.
   */
  MASTER_WALLET_PRIVATE_KEY: str(),

  // ─── Encryption (deposit address private keys at rest) ─────────────────────
  /** 64-char hex string = 32 bytes; used for AES-256-GCM */
  ENCRYPTION_KEY: str(),
  ENCRYPTION_IV_LENGTH: num({ default: 12 }),

  // ─── AWS S3 ────────────────────────────────────────────────────────────────
  AWS_ACCESS_KEY_ID: str({ default: '' }),
  AWS_SECRET_ACCESS_KEY: str({ default: '' }),
  AWS_REGION: str({ default: 'us-east-1' }),
  AWS_S3_BUCKET: str({ default: 'peptest-coas' }),
  /** Optional — set for MinIO or other S3-compatible storage */
  AWS_S3_ENDPOINT: str({ default: '' }),
  /** TTL in seconds for pre-signed URLs; 3600 = 1 hour */
  S3_SIGNED_URL_TTL_SECONDS: num({ default: 3600 }),

  // ─── Email ────────────────────────────────────────────────────────────────────
  EMAIL_PROVIDER: str({
    choices: ['nodemailer', 'resend'],
    default: 'nodemailer',
    desc: 'Email delivery provider to use',
  }),
  // Nodemailer SMTP settings
  SMTP_HOST: str({ default: 'smtp.gmail.com' }),
  SMTP_PORT: num({ default: 587 }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASS: str({ default: '' }),
  // Resend API settings
  RESEND_API_KEY: str({ default: '' }),
  // Common email settings
  EMAIL_FROM: str({ default: 'noreply@peptest.com' }),
  OPERATOR_ALERT_EMAIL: str({ default: 'ops@peptest.com' }),

  // ─── Test only ─────────────────────────────────────────────────────────────
  TEST_MASTER_WALLET_PUBKEY: str({ default: '' }),
  TEST_MASTER_WALLET_KEY: str({ default: '' }),
});
