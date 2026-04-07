/**
 * CoaService — COA upload (§7.12), OCR trigger, and admin verification (§7.13).
 * Magic-byte validation, S3 upload, OCR queuing, and state advancement.
 */
import { injectable, inject } from 'tsyringe';
import pino from 'pino';
import { fromBuffer } from 'file-type';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';
import { CampaignService } from './campaign.service';
import { ConfigurationService, type MaxFileSizeConfig } from './configuration.service';
import { OcrService } from './ocr.service';
import { ocrQueue, type OcrJobPayload } from '../utils/queue.util';
import { ConflictError, NotFoundError, ValidationError, AuthorizationError } from '../utils/errors';
import type { CoaDto, AdminVerifyCoaDto } from 'common';

const logger = pino({ name: 'CoaService' });

@injectable()
export class CoaService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(NotificationService) private readonly notifService: NotificationService,
    @inject(StorageService) private readonly storageService: StorageService,
    @inject(CampaignService) private readonly campaignService: CampaignService,
    @inject(ConfigurationService) private readonly configService: ConfigurationService,
    @inject(OcrService) private readonly ocrService: OcrService
  ) {}

  /**
   * Upload a COA PDF for a sample — spec §7.12.
   * Validates: file type (magic bytes), file size, campaign status, existing COA state.
   */
  async uploadCoa(
    userId: string,
    campaignId: string,
    sampleId: string,
    fileBuffer: Buffer,
    originalFileName: string
  ): Promise<CoaDto> {
    // Load config
    const maxFileSizeConfig =
      await this.configService.get<MaxFileSizeConfig>('max_file_size_bytes');
    const maxFileSize = maxFileSizeConfig.value;

    // File size check (spec §5.3 — before reading content)
    if (fileBuffer.length > maxFileSize) {
      throw new ValidationError(`File size exceeds maximum of ${maxFileSize} bytes`);
    }

    // Magic-byte validation — must be PDF (spec §5.3)
    const fileType = await fromBuffer(fileBuffer.slice(0, 8));
    if (!fileType || fileType.mime !== 'application/pdf') {
      throw new ValidationError('File must be a valid PDF (magic-byte check failed)');
    }

    // Verify campaign and sample
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (campaign === null) throw new NotFoundError('Campaign not found');
    if (campaign.creator_id !== userId) throw new AuthorizationError('Not your campaign');
    if (campaign.status !== 'samples_sent') {
      throw new ConflictError('Campaign must be in samples_sent status to upload COA');
    }

    const sample = await this.prisma.sample.findFirst({
      where: { id: sampleId, campaign_id: campaignId },
    });
    if (sample === null) throw new NotFoundError('Sample not found in this campaign');

    // Check existing COA state
    const existingCoa = await this.prisma.coa.findUnique({ where: { sample_id: sampleId } });
    if (existingCoa !== null) {
      if (
        existingCoa.verification_status === 'code_found' ||
        existingCoa.verification_status === 'manually_approved'
      ) {
        throw new ConflictError('Cannot replace a verified COA');
      }
      if (existingCoa.verification_status === 'pending') {
        throw new ConflictError('OCR in progress — wait for verification before re-uploading');
      }
      // code_not_found or rejected → allow re-upload; delete previous S3 object
      await this.storageService.delete(existingCoa.s3_key);
    }

    // Upload to S3
    const s3Key = `coas/${campaignId}/${sampleId}/${Date.now()}.pdf`;
    await this.storageService.upload(s3Key, fileBuffer, 'application/pdf');

    // Upsert COA row
    const coa = await this.prisma.coa.upsert({
      where: { sample_id: sampleId },
      create: {
        sample_id: sampleId,
        campaign_id: campaignId,
        s3_key: s3Key,
        file_name: originalFileName,
        file_size_bytes: fileBuffer.length,
        uploaded_by_user_id: userId,
        verification_status: 'pending',
      },
      update: {
        s3_key: s3Key,
        file_name: originalFileName,
        file_size_bytes: fileBuffer.length,
        uploaded_by_user_id: userId,
        uploaded_at: new Date(),
        verification_status: 'pending',
        ocr_text: null,
        verified_by_user_id: null,
        verified_at: null,
        verification_notes: null,
      },
    });

    // Enqueue OCR job
    const ocrPayload: OcrJobPayload = { coa_id: coa.id };
    await ocrQueue.add(ocrPayload);

    // Notify all admin/lab_approver users
    await this.notifyReviewers(campaignId, coa.id);

    this.audit.log({
      userId,
      action: 'coa.uploaded',
      entityType: 'coa',
      entityId: coa.id,
    });

    logger.info({ coaId: coa.id, campaignId, sampleId }, 'COA uploaded');

    return {
      id: coa.id,
      sample_id: coa.sample_id,
      file_url: await this.storageService.getSignedUrl(coa.s3_key),
      file_name: coa.file_name,
      file_size_bytes: coa.file_size_bytes,
      uploaded_at: coa.uploaded_at.toISOString(),
      verification_status: coa.verification_status,
      verification_notes: coa.verification_notes,
      verified_at: coa.verified_at?.toISOString() ?? null,
    };
  }

  /**
   * Verify or reject a COA — spec §7.13. Caller must have admin or lab_approver claim.
   */
  async verifyCoa(callerId: string, coaId: string, dto: AdminVerifyCoaDto): Promise<CoaDto> {
    const coa = await this.prisma.coa.findUnique({ where: { id: coaId } });
    if (coa === null) throw new NotFoundError('COA not found');

    if (dto.status === 'approved') {
      await this.prisma.coa.update({
        where: { id: coaId },
        data: {
          verification_status: 'manually_approved',
          verified_by_user_id: callerId,
          verified_at: new Date(),
          ...(dto.notes !== undefined ? { verification_notes: dto.notes } : {}),
        },
      });

      // Check if ALL samples now have verified COAs
      const totalSamples = await this.prisma.sample.count({
        where: { campaign_id: coa.campaign_id },
      });
      const verifiedCoas = await this.prisma.coa.count({
        where: {
          campaign_id: coa.campaign_id,
          verification_status: { in: ['manually_approved'] },
        },
      });

      if (verifiedCoas >= totalSamples) {
        // All COAs verified → advance to results_published then resolve
        await this.prisma.$transaction(async (tx) => {
          const campaign = await tx.campaign.findUniqueOrThrow({ where: { id: coa.campaign_id } });
          await tx.campaign.update({
            where: { id: coa.campaign_id },
            data: { status: 'results_published', results_published_at: new Date() },
          });
          await tx.campaignUpdate.create({
            data: {
              campaign_id: coa.campaign_id,
              author_id: callerId,
              content: 'All COAs verified — results published',
              update_type: 'state_change',
              state_change_from: 'samples_sent',
              state_change_to: 'results_published',
            },
          });
          // Prevent unused variable TS warning
          void campaign;
        });

        // Call resolveCampaign (spec §7.13 says call it immediately)
        await this.campaignService.resolveCampaign(coa.campaign_id);
      }

      this.audit.log({
        userId: callerId,
        action: 'coa.verified',
        entityType: 'coa',
        entityId: coaId,
      });
    } else {
      // Rejected — increment per-COA counter, check 3-strikes for this sample
      const campaign = await this.prisma.campaign.findUniqueOrThrow({
        where: { id: coa.campaign_id },
      });

      // Single update: mark rejected AND increment rejection_count atomically
      const updatedCoa = await this.prisma.coa.update({
        where: { id: coaId },
        data: {
          verification_status: 'rejected',
          verified_by_user_id: callerId,
          verified_at: new Date(),
          ...(dto.notes !== undefined ? { verification_notes: dto.notes } : {}),
          rejection_count: { increment: 1 },
        },
      });

      await this.prisma.campaign.update({
        where: { id: coa.campaign_id },
        data: {
          is_flagged_for_review: true,
          flagged_reason: `COA rejected: ${dto.notes ?? 'no reason given'}`,
        },
      });

      if (updatedCoa.rejection_count >= 3) {
        // 3 strikes on this specific sample — auto-refund the whole campaign
        await this.campaignService.refundContributions(
          coa.campaign_id,
          'Campaign auto-refunded: 3 COAs rejected for the same sample — potential fraud'
        );
        this.audit.log({
          userId: callerId,
          action: 'campaign.auto_refunded_3_strikes',
          entityType: 'campaign',
          entityId: coa.campaign_id,
          changes: {
            reason: '3 COAs rejected for same sample',
            coa_id: coaId,
            rejection_count: updatedCoa.rejection_count,
          },
        });
      } else {
        await this.notifService.send(
          campaign.creator_id,
          'coa_uploaded',
          coa.campaign_id,
          'COA Rejected',
          `Your COA for this sample was rejected: ${dto.notes ?? 'no reason given'}. This sample has ${updatedCoa.rejection_count}/3 rejections. After 3 rejections on the same sample, the campaign will be auto-refunded.`
        );
      }

      this.audit.log({
        userId: callerId,
        action: 'coa.rejected',
        entityType: 'coa',
        entityId: coaId,
      });
    }

    const updated = await this.prisma.coa.findUniqueOrThrow({ where: { id: coaId } });
    return {
      id: updated.id,
      sample_id: updated.sample_id,
      file_url: await this.storageService.getSignedUrl(updated.s3_key),
      file_name: updated.file_name,
      file_size_bytes: updated.file_size_bytes,
      uploaded_at: updated.uploaded_at.toISOString(),
      verification_status: updated.verification_status,
      verification_notes: updated.verification_notes,
      verified_at: updated.verified_at?.toISOString() ?? null,
    };
  }

  /** Update COA OCR results (called by OCR worker). */
  async updateOcrResult(coaId: string, text: string, codeFound: boolean): Promise<void> {
    await this.prisma.coa.update({
      where: { id: coaId },
      data: {
        ocr_text: text,
        verification_status: codeFound ? 'code_found' : 'code_not_found',
      },
    });
  }

  /**
   * Run OCR synchronously for admin on-demand trigger.
   * Resets any prior admin verification so the admin can re-review.
   */
  async runOcrForAdmin(coaId: string): Promise<CoaDto> {
    const coa = await this.prisma.coa.findUnique({ where: { id: coaId } });
    if (coa === null) throw new NotFoundError('COA not found');

    const campaign = await this.prisma.campaign.findUnique({ where: { id: coa.campaign_id } });
    if (campaign === null) throw new NotFoundError('Campaign not found');

    const result = await this.ocrService.processCoaPdf(coa.s3_key, campaign.verification_code);

    const updated = await this.prisma.coa.update({
      where: { id: coaId },
      data: {
        ocr_text: result.text,
        verification_status: result.codeFound ? 'code_found' : 'code_not_found',
        // Reset any prior admin decision so they can re-review
        verified_by_user_id: null,
        verified_at: null,
        verification_notes: null,
      },
    });

    this.audit.log({
      userId: 'system',
      action: 'coa.ocr_rerun',
      entityType: 'coa',
      entityId: coaId,
      changes: { codeFound: result.codeFound },
    });

    return {
      id: updated.id,
      sample_id: updated.sample_id,
      file_url: await this.storageService.getSignedUrl(updated.s3_key),
      file_name: updated.file_name,
      file_size_bytes: updated.file_size_bytes,
      uploaded_at: updated.uploaded_at.toISOString(),
      verification_status: updated.verification_status,
      verification_notes: updated.verification_notes,
      verified_at: updated.verified_at?.toISOString() ?? null,
    };
  }

  private async notifyReviewers(campaignId: string, _coaId: string): Promise<void> {
    // Find all users with admin or lab_approver claims
    const reviewerClaims = await this.prisma.userClaim.findMany({
      where: { claim_type: { in: ['admin', 'lab_approver'] } },
      select: { user_id: true },
      distinct: ['user_id'],
    });

    await Promise.all(
      reviewerClaims.map((claim) =>
        this.notifService.send(
          claim.user_id,
          'coa_uploaded',
          campaignId,
          'New COA Uploaded',
          'A creator has uploaded a COA for review.'
        )
      )
    );
  }
}
