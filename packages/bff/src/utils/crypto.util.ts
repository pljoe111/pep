/**
 * AES-256-GCM encryption/decryption utilities for deposit address private keys.
 * The ENCRYPTION_KEY is read from env; the decrypted key is NEVER logged.
 * Coding rules §8.2.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../config/env.config';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

/** Encrypt a UTF-8 plaintext string. Returns base64-encoded "iv:ciphertext:authTag". */
export function encryptString(plaintext: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(env.ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), encrypted.toString('hex'), authTag.toString('hex')].join(':');
}

/** Decrypt a value previously produced by encryptString. */
export function decryptString(encryptedValue: string): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  // SAFETY: we just verified parts.length === 3 above.
  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');

  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Generate a cryptographically secure random hex string of `byteLength` bytes. */
export function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}
