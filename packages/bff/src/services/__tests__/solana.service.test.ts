/**
 * SolanaService unit tests — spec §6 (ON-OFF-RAMP-TEST-PLAN.md).
 *
 * Does NOT require a local Solana validator.
 *
 * Mocking strategy:
 *   - @solana/web3.js: Connection is replaced with a stub; Transaction.serialize/sign
 *     are no-ops. Keypair and PublicKey remain REAL so fromSecretKey validation passes.
 *   - @solana/spl-token: all SPL helpers replaced with vi.fn() stubs.
 *   - ../../utils/crypto.util: decryptString stubbed; return value (valid 64-byte keypair
 *     hex) is initialised in beforeAll after generating a real Keypair with vi.importActual.
 *
 * Dynamic import inside beforeAll ensures env vars are evaluated first.
 */

// ─── Module-level mock function instances ─────────────────────────────────────
// Declared before vi.mock() factories so their closures capture the references.

const mockDecryptString = vi.fn(); // impl set in beforeAll with valid keypair hex

// @solana/spl-token
const mockGetAssocTokenAddr = vi.fn();
const mockGetOrCreateATA = vi.fn();
const mockCreateTransferIx = vi.fn();

// @solana/web3.js Connection methods
const mockGetLatestBlockhash = vi.fn();
const mockSendRawTransaction = vi.fn();
const mockConfirmTransaction = vi.fn();
const mockGetSignaturesForAddress = vi.fn();
const mockGetTokenAccountBalance = vi.fn();

/** Stable object returned by every `new Connection(...)` call inside SolanaService. */
const mockConnectionInstance = {
  getLatestBlockhash: mockGetLatestBlockhash,
  sendRawTransaction: mockSendRawTransaction,
  confirmTransaction: mockConfirmTransaction,
  getSignaturesForAddress: mockGetSignaturesForAddress,
  getTokenAccountBalance: mockGetTokenAccountBalance,
};

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

/**
 * Replace Connection and Transaction with mocks; keep everything else (Keypair,
 * PublicKey, LAMPORTS_PER_SOL, …) real via vi.importActual spread so that
 * Keypair.fromSecretKey validation succeeds when SolanaService is constructed.
 */
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => mockConnectionInstance),
    Transaction: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      sign: vi.fn(),
      serialize: vi.fn().mockReturnValue(Buffer.from('mock-serialized-tx')),
      feePayer: null as unknown,
      recentBlockhash: undefined as string | undefined,
    })),
  };
});

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: mockGetAssocTokenAddr,
  createTransferInstruction: mockCreateTransferIx,
  getOrCreateAssociatedTokenAccount: mockGetOrCreateATA,
}));

/** Simple sync factory — decryptString return value is configured in beforeAll. */
vi.mock('../../utils/crypto.util', () => ({
  decryptString: mockDecryptString,
  encryptString: vi.fn().mockReturnValue('enc:mock:val'),
  randomHex: vi.fn().mockReturnValue('aabbccdd'),
}));

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { SolanaService } from '../solana.service';

// ─── Shared state ─────────────────────────────────────────────────────────────
let service!: SolanaService;

/**
 * 128-char hex-encoded 64-byte ed25519 secret key for the test deposit address.
 * Generated once in beforeAll; re-applied to mockDecryptString in beforeEach.
 */
let validDepositKeypairHex = '';

const TEST_SIGNATURE = 'test_onchain_signature_abc123';
const MOCK_BLOCKHASH = 'mock_blockhash_xyz';
const DEST_PUBKEY = '11111111111111111111111111111111';
const MOCK_ATA_STUB = { address: DEST_PUBKEY };

// ─── Env + service bootstrap ──────────────────────────────────────────────────
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.PYUSD_MINT = 'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM'; // devnet PyUSD
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.SOLANA_RPC_URL = 'http://localhost:8899';
  process.env.SOLANA_NETWORK = 'testnet';
  process.env.REDIS_URL = 'redis://localhost:6379';

  // Use the ACTUAL (non-mocked) @solana/web3.js to generate valid ed25519 key pairs.
  // Two-step assignment ensures TypeScript resolves members from the typed module.
  const web3Actual: typeof import('@solana/web3.js') = await vi.importActual('@solana/web3.js');

  const bs58Actual: typeof import('bs58') = await vi.importActual('bs58');

  // Master wallet: real valid keypair so Keypair.fromSecretKey passes validation
  const masterKP = web3Actual.Keypair.generate();
  process.env.MASTER_WALLET_PRIVATE_KEY = bs58Actual.default.encode(masterKP.secretKey);
  process.env.MASTER_WALLET_PUBLIC_KEY = masterKP.publicKey.toBase58();

  // Deposit wallet: real valid keypair; hex stored for decryptString mock
  const depositKP = web3Actual.Keypair.generate();
  validDepositKeypairHex = Buffer.from(depositKP.secretKey).toString('hex');

  vi.resetModules();

  const { SolanaService: SS } = await import('../solana.service');
  // Connection is mocked, so no real RPC connection is made.
  service = new SS();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Restore mocked implementations after clearAllMocks resets them.
  mockDecryptString.mockReturnValue(validDepositKeypairHex);
  mockGetLatestBlockhash.mockResolvedValue({ blockhash: MOCK_BLOCKHASH });
  mockSendRawTransaction.mockResolvedValue(TEST_SIGNATURE);
  mockConfirmTransaction.mockResolvedValue({ value: {} });
  mockGetOrCreateATA.mockResolvedValue(MOCK_ATA_STUB);
  mockGetAssocTokenAddr.mockResolvedValue(DEST_PUBKEY);
  mockCreateTransferIx.mockReturnValue({ keys: [], data: Buffer.alloc(9), programId: null });
});

// ─── §6: sweepDeposit — success ───────────────────────────────────────────────
describe('SolanaService §6 — sweepDeposit success', () => {
  it('returns a non-empty signature string on successful sweep', async () => {
    const result = await service.sweepDeposit('some:encrypted:private:key', 50_000_000n, 'usdc');

    expect(result).toBe(TEST_SIGNATURE);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    expect(mockGetLatestBlockhash).toHaveBeenCalledOnce();
    expect(mockSendRawTransaction).toHaveBeenCalledOnce();
    expect(mockConfirmTransaction).toHaveBeenCalledWith(TEST_SIGNATURE, 'confirmed');
  });
});

// ─── §6: sweepDeposit — sendRawTransaction throws ─────────────────────────────
describe('SolanaService §6 — sweepDeposit propagates sendRawTransaction error', () => {
  it('re-throws when sendRawTransaction rejects', async () => {
    mockSendRawTransaction.mockRejectedValue(
      new Error('SendTransactionError: insufficient funds for fee')
    );

    await expect(service.sweepDeposit('some:encrypted:key', 50_000_000n, 'usdc')).rejects.toThrow(
      'SendTransactionError: insufficient funds for fee'
    );
  });
});

// ─── §6: executeWithdrawal — success ──────────────────────────────────────────
describe('SolanaService §6 — executeWithdrawal success', () => {
  it('returns a non-empty signature on successful withdrawal', async () => {
    const result = await service.executeWithdrawal(DEST_PUBKEY, 10_000_000n, 'usdc');

    expect(result).toBe(TEST_SIGNATURE);
    expect(mockSendRawTransaction).toHaveBeenCalledOnce();
    expect(mockConfirmTransaction).toHaveBeenCalledWith(TEST_SIGNATURE, 'confirmed');
  });
});

// ─── §6: executeWithdrawal — getOrCreateAssociatedTokenAccount throws ─────────
describe('SolanaService §6 — executeWithdrawal propagates ATA creation error', () => {
  it('re-throws when getOrCreateAssociatedTokenAccount rejects', async () => {
    mockGetOrCreateATA.mockRejectedValue(new Error('Account does not exist'));

    await expect(service.executeWithdrawal(DEST_PUBKEY, 10_000_000n, 'usdc')).rejects.toThrow(
      'Account does not exist'
    );
  });
});

// ─── §6: getSignaturesForAddress ──────────────────────────────────────────────
describe('SolanaService §6 — getSignaturesForAddress passthrough', () => {
  it('returns exactly the 2 ConfirmedSignatureInfo entries from the Connection mock', async () => {
    const fakeSigs = [
      { signature: 'sig_A', slot: 100, err: null, memo: null, blockTime: null },
      { signature: 'sig_B', slot: 101, err: null, memo: null, blockTime: null },
    ];
    mockGetSignaturesForAddress.mockResolvedValue(fakeSigs);

    const result = await service.getSignaturesForAddress(DEST_PUBKEY, 10);

    expect(result).toHaveLength(2);
    expect(result[0].signature).toBe('sig_A');
    expect(result[1].signature).toBe('sig_B');
  });
});

// ─── §6: getTokenBalance — ATA exists ─────────────────────────────────────────
describe('SolanaService §6 — getTokenBalance: ATA exists', () => {
  it('returns uiAmount × 10^6 when the ATA has a balance', async () => {
    mockGetTokenAccountBalance.mockResolvedValue({ value: { uiAmount: 150.5 } });

    const result = await service.getTokenBalance(DEST_PUBKEY, 'usdc');

    // 150.5 × 10^6 = 150_500_000
    expect(result).toBe(150_500_000);
  });
});

// ─── §6: getTokenBalance — ATA does not exist ─────────────────────────────────
describe('SolanaService §6 — getTokenBalance: ATA missing', () => {
  it('returns 0 and swallows the error when getTokenAccountBalance throws', async () => {
    mockGetTokenAccountBalance.mockRejectedValue(new Error('AccountNotFound'));

    const result = await service.getTokenBalance(DEST_PUBKEY, 'usdc');

    expect(result).toBe(0);
  });
});

// ─── §6: Amount precision — executeWithdrawal with 1n raw unit ────────────────
describe('SolanaService §6 — executeWithdrawal with 1n raw unit', () => {
  it('passes exactly 1n to createTransferInstruction (one micro-unit of SPL)', async () => {
    const result = await service.executeWithdrawal(DEST_PUBKEY, 1n, 'usdc');

    expect(result).toBe(TEST_SIGNATURE);

    // createTransferInstruction must receive the exact bigint 1n as the amount argument
    expect(mockCreateTransferIx).toHaveBeenCalledWith(
      expect.anything(), // sourceATA address
      expect.anything(), // destATA address
      expect.anything(), // authority (master wallet public key)
      1n, // amount — must be exactly bigint 1, not Number(1)
      expect.anything(), // multi-signers []
      expect.anything() // programId
    );
  });
});

// ─── §6: swapToUsdt — USDC happy path ─────────────────────────────────────────

// Mock-level fetch stub — declared at module scope for the swap tests
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('SolanaService §6 — swapToUsdt: USDC → USDT success', () => {
  it('returns usdtReceived equal to quoteData.outAmount and a valid signature', async () => {
    const fakeOutAmount = '99500000'; // 99.5 USDT raw units
    const fakeSwapTx = Buffer.from('fake-versioned-tx').toString('base64');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ outAmount: fakeOutAmount, otherField: 'ignored' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ swapTransaction: fakeSwapTx }),
      });

    // VersionedTransaction.deserialize must be stubbed — the tx buf is not a real Solana tx
    const web3Actual: typeof import('@solana/web3.js') = await vi.importActual('@solana/web3.js');
    const mockVersionedTx = {
      sign: vi.fn(),
      serialize: vi.fn().mockReturnValue(Buffer.from('serialized-swap-tx')),
    };
    vi.spyOn(web3Actual.VersionedTransaction, 'deserialize').mockReturnValue(
      mockVersionedTx as unknown as InstanceType<typeof web3Actual.VersionedTransaction>
    );

    const result = await service.swapToUsdt(100_000_000n, 'usdc');

    expect(result.usdtReceived).toBe(BigInt(fakeOutAmount));
    expect(result.signature).toBe(TEST_SIGNATURE);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call: Jupiter quote — must include inputMint=USDC and slippageBps=50
    const quoteUrl = (mockFetch.mock.calls[0] as [string])[0];
    expect(quoteUrl).toContain('slippageBps=50');
    expect(quoteUrl).toContain('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint
  });
});

describe('SolanaService §6 — swapToUsdt: PyUSD → USDT uses 100 bps slippage', () => {
  it('sends slippageBps=100 for pyusd and TOKEN_2022_PROGRAM_ID for ATA derivation', async () => {
    const fakeOutAmount = '99000000';
    const fakeSwapTx = Buffer.from('fake-versioned-tx-pyusd').toString('base64');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ outAmount: fakeOutAmount }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ swapTransaction: fakeSwapTx }),
      });

    const web3Actual: typeof import('@solana/web3.js') = await vi.importActual('@solana/web3.js');
    const mockVersionedTx = {
      sign: vi.fn(),
      serialize: vi.fn().mockReturnValue(Buffer.from('serialized-swap-tx-pyusd')),
    };
    vi.spyOn(web3Actual.VersionedTransaction, 'deserialize').mockReturnValue(
      mockVersionedTx as unknown as InstanceType<typeof web3Actual.VersionedTransaction>
    );

    const result = await service.swapToUsdt(100_000_000n, 'pyusd');

    expect(result.usdtReceived).toBe(BigInt(fakeOutAmount));
    expect(result.signature).toBe(TEST_SIGNATURE);

    const quoteUrl = (mockFetch.mock.calls[0] as [string])[0];
    expect(quoteUrl).toContain('slippageBps=100');
  });
});

describe('SolanaService §6 — swapToUsdt: Jupiter quote failure throws', () => {
  it('throws when the Jupiter quote API returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });

    await expect(service.swapToUsdt(100_000_000n, 'usdc')).rejects.toThrow('Jupiter quote failed');
  });
});

describe('SolanaService §6 — swapToUsdt: Jupiter swap failure throws', () => {
  it('throws when the Jupiter swap API returns a non-ok response', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ outAmount: '99500000' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(service.swapToUsdt(100_000_000n, 'usdc')).rejects.toThrow('Jupiter swap failed');
  });
});
