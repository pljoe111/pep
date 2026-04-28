/**
 * SolanaService — blockchain interactions for deposits and withdrawals.
 *
 * SECURITY: MASTER_WALLET_PRIVATE_KEY is accessed here AND in withdrawal.worker.ts only.
 * Coding rules §8.3: this key must NEVER be logged.
 *
 * Uses @solana/web3.js v1 and @solana/spl-token v0.4.
 *
 * Supported currencies:
 *   usdc  — standard SPL (TOKEN_PROGRAM_ID)
 *   usdt  — standard SPL (TOKEN_PROGRAM_ID)
 *   pyusd — Token-2022   (TOKEN_2022_PROGRAM_ID)
 *           PayPal permanent-delegate risk: never hold PyUSD overnight.
 *           Swapped to USDT immediately on deposit ingress.
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
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import pino from 'pino';
import { env } from '../config/env.config';
import { decryptString } from '../utils/crypto.util';

const logger = pino({ name: 'SolanaService' });

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedCurrency = 'usdc' | 'usdt' | 'pyusd';

interface MintConfig {
  pubkey: PublicKey;
  decimals: number;
  /** TOKEN_PROGRAM_ID for usdc/usdt, TOKEN_2022_PROGRAM_ID for pyusd */
  programId: PublicKey;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@injectable()
export class SolanaService {
  private readonly connection: Connection;
  // SECURITY: masterKeypair is loaded once at startup; the private key is never logged.
  private readonly masterKeypair: Keypair;
  private readonly mintConfigs: Record<SupportedCurrency, MintConfig>;

  constructor() {
    this.connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
    // SAFETY: MASTER_WALLET_PRIVATE_KEY is validated at startup via env.config.ts.
    // Only accessed here and in withdrawal.worker.ts per coding rules §8.3.
    const masterSecretBytes = bs58.decode(env.MASTER_WALLET_PRIVATE_KEY);
    this.masterKeypair = Keypair.fromSecretKey(masterSecretBytes);

    this.mintConfigs = {
      usdc: {
        pubkey: new PublicKey(env.USDC_MINT),
        decimals: 6,
        programId: TOKEN_PROGRAM_ID,
      },
      usdt: {
        pubkey: new PublicKey(env.USDT_MINT),
        decimals: 6,
        programId: TOKEN_PROGRAM_ID,
      },
      pyusd: {
        pubkey: new PublicKey(env.PYUSD_MINT),
        decimals: 6,
        programId: TOKEN_2022_PROGRAM_ID,
      },
    };
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
   * Threads the correct TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID per mint.
   * Returns the transaction signature on success.
   */
  async sweepDeposit(
    encryptedPrivateKey: string,
    amount: bigint,
    mint: SupportedCurrency
  ): Promise<string> {
    const { pubkey: mintPubkey, programId } = this.mintConfigs[mint];

    // Decrypt deposit private key (never logged)
    const depositPrivateKeyHex = decryptString(encryptedPrivateKey);
    const depositKeypair = Keypair.fromSecretKey(Buffer.from(depositPrivateKeyHex, 'hex'));

    // Get or create token accounts — pass programId for Token-2022 support
    const sourceATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair, // fee payer for account creation
      mintPubkey,
      depositKeypair.publicKey,
      false,
      'confirmed',
      undefined,
      programId
    );

    const destATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair,
      mintPubkey,
      this.masterKeypair.publicKey,
      false,
      'confirmed',
      undefined,
      programId
    );

    // Build transfer instruction
    const transferIx = createTransferInstruction(
      sourceATA.address,
      destATA.address,
      depositKeypair.publicKey,
      amount,
      [],
      programId
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
   * Withdrawals are always USDT — mint param kept for forward compatibility.
   */
  async executeWithdrawal(
    destinationAddress: string,
    amount: bigint,
    mint: SupportedCurrency
  ): Promise<string> {
    const { pubkey: mintPubkey, programId } = this.mintConfigs[mint];
    const destPubkey = new PublicKey(destinationAddress);

    const sourceATA = await getAssociatedTokenAddress(
      mintPubkey,
      this.masterKeypair.publicKey,
      false,
      programId
    );

    const destATA = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.masterKeypair,
      mintPubkey,
      destPubkey,
      false,
      'confirmed',
      undefined,
      programId
    );

    const transferIx = createTransferInstruction(
      sourceATA,
      destATA.address,
      this.masterKeypair.publicKey,
      amount,
      [],
      programId
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
   * Get SPL token balance for an address (raw units, not display units).
   * Used by the reconciliation job and consolidation service.
   * Returns raw units (multiply by 10^decimals already done via uiAmount re-scaling).
   */
  async getTokenBalance(ownerAddress: string, mint: SupportedCurrency): Promise<number> {
    const { pubkey: mintPubkey, decimals, programId } = this.mintConfigs[mint];
    const ownerPubkey = new PublicKey(ownerAddress);

    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey, false, programId);
      const balance = await this.connection.getTokenAccountBalance(ata);
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
   * Swap any supported non-USDT currency → USDT on the master wallet via Jupiter v6 API.
   *
   * Slippage tolerance:
   *   usdc  →  50 bps (0.5%) — deep, liquid pool
   *   pyusd → 100 bps (1.0%) — thinner pool; PayPal permanent-delegate clawback risk
   *
   * Returns usdtReceived (actual raw USDT from quoteData.outAmount) and signature.
   * The caller is responsible for applying the platform conversion fee on top.
   * This method does NOT touch the ledger — pure on-chain operation.
   *
   * Throws on any API or transaction failure.
   */
  async swapToUsdt(
    amountRaw: bigint,
    fromCurrency: Exclude<SupportedCurrency, 'usdt'>
  ): Promise<{ usdtReceived: bigint; signature: string }> {
    const { pubkey: inputMint } = this.mintConfigs[fromCurrency];
    const slippageBps = fromCurrency === 'pyusd' ? '100' : '50';

    const quoteParams = new URLSearchParams({
      inputMint: inputMint.toBase58(),
      outputMint: env.USDT_MINT,
      amount: amountRaw.toString(),
      slippageBps,
    });

    const quoteRes = await fetch(`https://quote-api.jup.ag/v6/quote?${quoteParams.toString()}`);
    if (!quoteRes.ok) {
      throw new Error(`Jupiter quote failed: ${quoteRes.status} ${quoteRes.statusText}`);
    }

    const quoteData = (await quoteRes.json()) as { outAmount: string; [key: string]: unknown };
    const usdtReceived = BigInt(quoteData.outAmount);

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
      throw new Error(`Jupiter swap failed: ${swapRes.status} ${swapRes.statusText}`);
    }

    const swapData = (await swapRes.json()) as { swapTransaction: string };
    const txBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([this.masterKeypair]);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await this.connection.confirmTransaction(signature, 'confirmed');

    logger.info(
      {
        fromCurrency,
        amountRaw: amountRaw.toString(),
        usdtReceived: usdtReceived.toString(),
        signature,
      },
      'Deposit swap to USDT confirmed'
    );
    return { usdtReceived, signature };
  }
}
