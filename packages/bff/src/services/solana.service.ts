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
  VersionedTransaction,
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
   * Fetch raw SPL token balances for multiple ATA addresses in a single RPC call.
   * Batches in chunks of 100 (Solana RPC limit for getMultipleAccounts).
   * Returns a Map of ataAddress → raw token amount (bigint, 0n if account absent).
   *
   * SPL token account layout (165 bytes):
   *   bytes  0–31 : mint pubkey
   *   bytes 32–63 : owner pubkey
   *   bytes 64–71 : amount (u64 little-endian)
   */
  async getMultipleTokenBalances(ataAddresses: string[]): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();
    if (ataAddresses.length === 0) return result;

    const CHUNK_SIZE = 100;
    for (let i = 0; i < ataAddresses.length; i += CHUNK_SIZE) {
      const chunk = ataAddresses.slice(i, i + CHUNK_SIZE);
      const pubkeys = chunk.map((a) => new PublicKey(a));
      const accounts = await this.connection.getMultipleAccountsInfo(pubkeys, 'confirmed');
      for (let j = 0; j < chunk.length; j++) {
        const acc = accounts[j];
        if (acc === null || acc.data.length < 72) {
          result.set(chunk[j], 0n);
        } else {
          // amount is a u64 at byte offset 64, read as little-endian BigInt
          result.set(chunk[j], acc.data.readBigUInt64LE(64));
        }
      }
    }
    return result;
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

  /**
   * Swap USDC → USDT on the master wallet via Jupiter v6 API.
   * Used by ConsolidationService. On-chain signature returned on success.
   * Throws on any API or transaction failure.
   */
  async swapUsdcToUsdt(amountRaw: bigint): Promise<string> {
    const quoteParams = new URLSearchParams({
      inputMint: env.USDC_MINT,
      outputMint: env.USDT_MINT,
      amount: amountRaw.toString(),
      slippageBps: '50',
    });

    const quoteRes = await fetch(`https://quote-api.jup.ag/v6/quote?${quoteParams.toString()}`);
    if (!quoteRes.ok) {
      throw new Error(`Jupiter quote request failed: ${quoteRes.status} ${quoteRes.statusText}`);
    }
    const quoteData: unknown = await quoteRes.json();

    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: this.masterKeypair.publicKey.toBase58(),
        wrapAndUnwrapSol: false,
      }),
    });
    if (!swapRes.ok) {
      throw new Error(
        `Jupiter swap transaction request failed: ${swapRes.status} ${swapRes.statusText}`
      );
    }

    const swapData = (await swapRes.json()) as { swapTransaction: string };
    const transactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([this.masterKeypair]);

    const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
    await this.connection.confirmTransaction(signature, 'confirmed');

    logger.info({ amountRaw: amountRaw.toString(), signature }, 'USDC→USDT Jupiter swap confirmed');
    return signature;
  }
}
