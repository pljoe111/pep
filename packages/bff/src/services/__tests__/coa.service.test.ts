/**
 * CoaService unit tests — 3-strikes COA rejection logic (per-COA/sample).
 *
 * The counter lives on the Coa row. Auto-refund triggers when a SINGLE sample's
 * COA reaches 3 rejections — not a campaign-level total.
 * Uses vi.fn() mocks for all dependencies; no DB or Redis connection required.
 */

// Hoist queue mock before any module imports (prevents Bull from connecting to Redis).
vi.mock('../../utils/queue.util', () => ({
  withdrawalQueue: { add: vi.fn().mockResolvedValue(undefined) },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined) },
  ocrQueue: { add: vi.fn().mockResolvedValue(undefined) },
  depositScannerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  deadlineMonitorQueue: { add: vi.fn().mockResolvedValue(undefined) },
  reconciliationQueue: { add: vi.fn().mockResolvedValue(undefined) },
  refreshTokenCleanupQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { CoaService } from '../coa.service';
import type { PrismaService } from '../prisma.service';
import type { AuditService } from '../audit.service';
import type { NotificationService } from '../notification.service';
import type { StorageService } from '../storage.service';
import type { CampaignService } from '../campaign.service';
import type { ConfigurationService } from '../configuration.service';
import type { OcrService } from '../ocr.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-uuid-0000-0000-0000-000000000000';
const CREATOR_ID = 'creator-uuid-0000-0000-0000-000000000000';
const CAMPAIGN_ID = 'campaign-uuid-0000-0000-0000-000000000000';
const COA_ID = 'coa-uuid-0000-0000-0000-000000000000';
const SAMPLE_ID = 'sample-uuid-0000-0000-0000-000000000000';

function makeCoa(rejectionCount = 0): {
  id: string;
  sample_id: string;
  campaign_id: string;
  s3_key: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_by_user_id: string;
  uploaded_at: Date;
  ocr_text: null;
  verification_status: string;
  verified_by_user_id: null;
  verified_at: null;
  verification_notes: null;
  rejection_count: number;
} {
  return {
    id: COA_ID,
    sample_id: SAMPLE_ID,
    campaign_id: CAMPAIGN_ID,
    s3_key: 'coas/test-key.pdf',
    file_name: 'test.pdf',
    file_size_bytes: 1024,
    uploaded_by_user_id: CREATOR_ID,
    uploaded_at: new Date(),
    ocr_text: null,
    verification_status: 'code_not_found',
    verified_by_user_id: null,
    verified_at: null,
    verification_notes: null,
    rejection_count: rejectionCount,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

let service!: CoaService;
let prismaFindCoa: ReturnType<typeof vi.fn>;
let prismaUpdateCoa: ReturnType<typeof vi.fn>;
let prismaFindCampaign: ReturnType<typeof vi.fn>;
let prismaUpdateCampaign: ReturnType<typeof vi.fn>;
let prismaSampleCount: ReturnType<typeof vi.fn>;
let prismaCoaCount: ReturnType<typeof vi.fn>;
let notifSend: ReturnType<typeof vi.fn>;
let refundContributions: ReturnType<typeof vi.fn>;
let auditLog: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/test';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters!!';
  process.env.USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  process.env.USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  process.env.MASTER_WALLET_PUBLIC_KEY = '11111111111111111111111111111111';
  process.env.MASTER_WALLET_PRIVATE_KEY =
    '5NemXetH19TAcuBd4ABz3URRDmxRPNrDDXFfgvzPT6KZkxGNv6kD3ZKuvjpgBN8GXbVCF8TkU9tMZPU6LEKF5qes';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.S3_BUCKET = 'test-bucket';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = 'test-access-key';
  process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.S3_ENDPOINT = 'http://localhost:9000';
  process.env.S3_SIGNED_URL_TTL_SECONDS = '3600';

  const { CoaService: CS } = await import('../coa.service');

  prismaFindCoa = vi.fn();
  prismaUpdateCoa = vi.fn();
  prismaFindCampaign = vi.fn();
  prismaUpdateCampaign = vi.fn();
  prismaSampleCount = vi.fn();
  prismaCoaCount = vi.fn();
  notifSend = vi.fn();
  refundContributions = vi.fn();
  auditLog = vi.fn();

  const prismaMock = {
    coa: {
      findUnique: prismaFindCoa,
      update: prismaUpdateCoa,
      count: prismaCoaCount,
    },
    campaign: {
      findUniqueOrThrow: prismaFindCampaign,
      update: prismaUpdateCampaign,
    },
    sample: { count: prismaSampleCount },
    userClaim: { findMany: vi.fn() },
    $transaction: vi.fn(),
  } as unknown as PrismaService;

  const auditMock = { log: auditLog } as unknown as AuditService;
  const notifMock = { send: notifSend } as unknown as NotificationService;
  const storageMock = {
    getSignedUrl: vi
      .fn<[string], Promise<string>>()
      .mockResolvedValue('https://signed.example.com/test.pdf'),
    upload: vi.fn(),
    delete: vi.fn(),
  } as unknown as StorageService;
  const campaignMock = {
    refundContributions,
    resolveCampaign: vi.fn(),
  } as unknown as CampaignService;
  const configMock = {
    get: vi
      .fn<[string], Promise<{ value: number }>>()
      .mockResolvedValue({ value: 10 * 1024 * 1024 }),
  } as unknown as ConfigurationService;
  const ocrMock = {} as unknown as OcrService;

  service = new CS(
    prismaMock,
    auditMock,
    notifMock,
    storageMock,
    campaignMock,
    configMock,
    ocrMock
  );
});

/**
 * Reset per-test state.
 * resultRejectionCount is what prisma.coa.update returns as rejection_count
 * (i.e. after the increment — the post-increment value).
 */
function setupRejection(resultRejectionCount: number): void {
  const coaRow = makeCoa(resultRejectionCount - 1); // pre-increment state
  prismaFindCoa.mockResolvedValue(coaRow);
  // coa.update returns the row with rejection_count already incremented
  prismaUpdateCoa.mockResolvedValue({
    ...coaRow,
    verification_status: 'rejected',
    rejection_count: resultRejectionCount,
  });
  prismaFindCampaign.mockResolvedValue({ id: CAMPAIGN_ID, creator_id: CREATOR_ID });
  prismaUpdateCampaign.mockResolvedValue({ id: CAMPAIGN_ID, is_flagged_for_review: true });
  notifSend.mockReset();
  refundContributions.mockReset();
  auditLog.mockReset();
  notifSend.mockResolvedValue(undefined);
  refundContributions.mockResolvedValue(undefined);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CoaService.verifyCoa — per-COA 3-strikes rejection', () => {
  it('1st rejection: COA update includes rejection_count increment, notifies user with 1/3, no refund', async () => {
    setupRejection(1);

    await service.verifyCoa(ADMIN_ID, COA_ID, { status: 'rejected', notes: 'fraud attempt' });

    // COA update must include rejection_count increment (not campaign update)
    const coaUpdateCall = prismaUpdateCoa.mock.calls[0] as [
      { where: { id: string }; data: { rejection_count: { increment: number } } },
    ];
    expect(coaUpdateCall[0].where.id).toBe(COA_ID);
    expect(coaUpdateCall[0].data.rejection_count).toStrictEqual({ increment: 1 });

    // Campaign update must NOT include any rejection counter
    const campaignUpdateCalls = (
      prismaUpdateCampaign.mock.calls as Array<[{ data: Record<string, unknown> }]>
    ).filter((c) => 'rejection_count' in (c[0]?.data ?? {}));
    expect(campaignUpdateCalls).toHaveLength(0);

    // User must be notified with 1/3 count
    expect(notifSend).toHaveBeenCalledOnce();
    const notifArgs = notifSend.mock.calls[0] as [string, string, string, string, string];
    expect(notifArgs[0]).toBe(CREATOR_ID);
    expect(notifArgs[4]).toContain('1/3');

    // No auto-refund
    expect(refundContributions).not.toHaveBeenCalled();

    // Audit log for coa.rejected
    const auditCalls = auditLog.mock.calls as Array<[{ action: string; entityId: string }]>;
    const rejectedEntry = auditCalls.find((c) => c[0].action === 'coa.rejected');
    expect(rejectedEntry).toBeDefined();
  });

  it('2nd rejection: COA rejection_count increments to 2, notifies user with 2/3, no refund', async () => {
    setupRejection(2);

    await service.verifyCoa(ADMIN_ID, COA_ID, { status: 'rejected', notes: 'still suspicious' });

    const coaUpdateCall = prismaUpdateCoa.mock.calls[0] as [
      { data: { rejection_count: { increment: number } } },
    ];
    expect(coaUpdateCall[0].data.rejection_count).toStrictEqual({ increment: 1 });

    expect(notifSend).toHaveBeenCalledOnce();
    const notifArgs = notifSend.mock.calls[0] as [string, string, string, string, string];
    expect(notifArgs[4]).toContain('2/3');

    expect(refundContributions).not.toHaveBeenCalled();
  });

  it('3rd rejection (3-strikes on same sample): auto-refunds campaign, no user notif, logs 3-strikes audit entry', async () => {
    setupRejection(3);

    await service.verifyCoa(ADMIN_ID, COA_ID, { status: 'rejected', notes: 'clear fraud' });

    // COA update still increments rejection_count
    const coaUpdateCall = prismaUpdateCoa.mock.calls[0] as [
      { data: { rejection_count: { increment: number } } },
    ];
    expect(coaUpdateCall[0].data.rejection_count).toStrictEqual({ increment: 1 });

    // Auto-refund must be triggered
    expect(refundContributions).toHaveBeenCalledOnce();
    const refundArgs = refundContributions.mock.calls[0] as [string, string];
    expect(refundArgs[0]).toBe(CAMPAIGN_ID);
    expect(refundArgs[1]).toContain('same sample');

    // User must NOT be notified (campaign is being refunded)
    expect(notifSend).not.toHaveBeenCalled();

    // Audit log must include the auto-refund entry
    const auditCalls = auditLog.mock.calls as Array<[{ action: string; entityId: string }]>;
    const autoRefundEntry = auditCalls.find(
      (c) => c[0].action === 'campaign.auto_refunded_3_strikes'
    );
    expect(autoRefundEntry).toBeDefined();
    expect(autoRefundEntry?.[0].entityId).toBe(CAMPAIGN_ID);

    // COA rejected audit entry must also be present
    const rejectedEntry = auditCalls.find((c) => c[0].action === 'coa.rejected');
    expect(rejectedEntry).toBeDefined();
  });

  it('different samples each rejected once: no auto-refund even at 3 total rejections across campaign', async () => {
    // Simulate: 3 different COAs, each rejected exactly once (rejection_count=1 per COA)
    // Per-campaign logic would have triggered at count=3; per-COA logic should NOT
    for (let i = 1; i <= 3; i++) {
      setupRejection(1); // Each individual COA hits rejection_count=1
      await service.verifyCoa(ADMIN_ID, `coa-${i.toString()}`, {
        status: 'rejected',
        notes: 'wrong file',
      });
      expect(refundContributions).not.toHaveBeenCalled();
    }
  });

  it('approval: rejection_count is NOT incremented on coa.update, no refund', async () => {
    const coaRow = makeCoa();
    prismaFindCoa.mockResolvedValue(coaRow);
    prismaUpdateCoa.mockResolvedValue({ ...coaRow, verification_status: 'manually_approved' });
    prismaSampleCount.mockResolvedValue(2);
    prismaCoaCount.mockResolvedValue(1);
    prismaUpdateCampaign.mockReset();
    refundContributions.mockReset();

    await service.verifyCoa(ADMIN_ID, COA_ID, { status: 'approved' });

    // Approval path must NOT increment rejection_count
    const coaUpdateCalls = (
      prismaUpdateCoa.mock.calls as Array<[{ data: Record<string, unknown> }]>
    ).filter((c) => 'rejection_count' in (c[0]?.data ?? {}));
    expect(coaUpdateCalls).toHaveLength(0);

    expect(refundContributions).not.toHaveBeenCalled();
  });
});
