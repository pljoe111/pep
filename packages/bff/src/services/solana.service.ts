/**
 * SolanaService — blockchain interactions for deposits and withdrawals.
 *
 * SECURITY: MASTER_WALLET_PRIVATE_KEY is accessed here AND in withdrawal.worker.ts only.
 * Coding rules §8.3: this key must NEVER be logged.
 *
 * Uses @solana/web3.js v1 and @solana/spl-token v0.4.
 */
import { injectable } from 'tsyringe';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  type ConfirmedSignatureInfo,
  type ParsedTransactionWithMeta,
  type VersionedTransactionResponse,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import pino from 'pino';
import { env } from '../config/env.config';
import { decryptString } from '../utils/crypto.util';

const logger = pino({ name: 'SolanaService' });

const USDC_DECIMALS = 6;
const USDT_DECIMALS = 6;

@injectable()
export class SolanaService {
  private readonly connection: Connection;
  // SECURITY: masterKeypair is loaded once at startup; the private key is never logged.
  private readonly masterKeypair: Keypair;
  private readonly usdcMint: PublicKey;
  private readonly usdtMint: PublicKey;

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
    // SAFETY: MASTER_WALLET_PRIVATE_KEY is validated at startup via env.config.ts.
    // Only accessed here and in withdrawal.worker.ts per coding rules §8.3.
    const masterSecretBytes = bs58.decode(env.MASTER_WALLET_PRIVATE_KEY);
    this.masterKeypair = Keypair.fromSecretKey(masterSecretBytes);
    this.usdcMint = new PublicKey(env.USDC_MINT);
    this.usdtMint = new PublicKey(env.USDT_MINT);
  }

  /** Fetch recent confirmed signatures for a given address. */
  async getSignaturesForAddress(publicKey: string, limit = 10): Promise<ConfirmedSignatureInfo[]> {
    return this.connection.getSignaturesForAddress(
      new PublicKey(publicKey),
      { limit },
      'confirmed'
    );
  }

  /** Fetch a parsed transaction by signature. */
  async getParsedTransaction(signature: string): Promise<ParsedTransactionWithMeta | null> {
    return this.connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  }

  /** Fetch a transaction (for confirmation checks). */
  async getTransaction(signature: string): Promise<VersionedTransactionResponse | null> {
    return this.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  }

  /**
   * Sweep SPL tokens from a deposit address to the master wallet.
   * Deposit keypair signs the transfer; master wallet pays SOL fees.
   * Returns the transaction signature on success.
   */
  async sweepDeposit(
    encryptedPrivateKey: string,
    amount: bigint,
    mint: 'usdc' | 'usdt'
  ): Promise<string> {
    const mintPubkey = mint === 'usdc' ? this.usdcMint : this.usdtMint;

    // Decrypt deposit private key (never logged)
    const depositPrivateKeyHex = decryptString(encryptedPrivateKey);
    const depositKeypair = Keypair.fromSecretKey(Buffer.from(depositPrivateKeyHex, 'hex'));

    // Get or create token accounts
    const sourceATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair, // fee payer for account creation
      mintPubkey,
      depositKeypair.publicKey
    );

    const destATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair,
      mintPubkey,
      this.masterKeypair.publicKey
    );

    // Build transfer instruction
    const transferIx = createTransferInstruction(
      sourceATA.address,
      destATA.address,
      depositKeypair.publicKey,
      amount
    );

    const tx = new Transaction().add(transferIx);
    tx.feePayer = this.masterKeypair.publicKey;
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Sign with both deposit keypair (authority) and master (fee payer)
    tx.sign(this.masterKeypair, depositKeypair);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    // Confirm transaction
    await this.connection.confirmTransaction(signature, 'confirmed');

    logger.info({ mint, signature }, 'Sweep transaction confirmed');
    return signature;
  }

  /**
   * Execute an SPL withdrawal from the master wallet to an external address.
   * Returns the transaction signature on success.
   */
  async executeWithdrawal(
    destinationAddress: string,
    amount: bigint,
    mint: 'usdc' | 'usdt'
  ): Promise<string> {
    const mintPubkey = mint === 'usdc' ? this.usdcMint : this.usdtMint;
    const destPubkey = new PublicKey(destinationAddress);

    const sourceATA = await getAssociatedTokenAddress(mintPubkey, this.masterKeypair.publicKey);

    const destATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair,
      mintPubkey,
      destPubkey
    );

    const transferIx = createTransferInstruction(
      sourceATA,
      destATA.address,
      this.masterKeypair.publicKey,
      amount
    );

    const tx = new Transaction().add(transferIx);
    tx.feePayer = this.masterKeypair.publicKey;
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    tx.sign(this.masterKeypair);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });

    await this.connection.confirmTransaction(signature, 'confirmed');

    logger.info(
      { mint, destination: destinationAddress, signature },
      'Withdrawal transaction confirmed'
    );
    return signature;
  }

  /**
   * Get SPL token balance for an address.
   * Used by the reconciliation job.
   */
  async getTokenBalance(ownerAddress: string, mint: 'usdc' | 'usdt'): Promise<number> {
    const mintPubkey = mint === 'usdc' ? this.usdcMint : this.usdtMint;
    const ownerPubkey = new PublicKey(ownerAddress);

    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
      const balance = await this.connection.getTokenAccountBalance(ata);
      const decimals = mint === 'usdc' ? USDC_DECIMALS : USDT_DECIMALS;
      return (balance.value.uiAmount ?? 0) * Math.pow(10, decimals);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ error: msg, ownerAddress, mint }, 'Could not fetch token balance');
      return 0;
    }
  }

  /** SOL balance check for monitoring. */
  async getSolBalance(address: string): Promise<number> {
    const lamports = await this.connection.getBalance(new PublicKey(address));
    return lamports / LAMPORTS_PER_SOL;
  }
}
