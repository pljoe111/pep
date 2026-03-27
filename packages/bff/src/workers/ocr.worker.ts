/**
 * OcrWorker — processes COA OCR jobs. Spec §10.3.
 * Concurrency: 5. Timeout: 60s. Retries: 2.
 */
import pino from 'pino';
import { container } from '../container';
import { ocrQueue, type OcrJobPayload } from '../utils/queue.util';
import { PrismaService } from '../services/prisma.service';
import { OcrService } from '../services/ocr.service';

const logger = pino({ name: 'OcrWorker' });

export function startOcrWorker(): void {
  void ocrQueue.process(5, async (job) => {
    const { coa_id } = job.data as OcrJobPayload;
    const prisma = container.resolve(PrismaService);
    const ocrService = container.resolve(OcrService);

    const coa = await prisma.coa.findUnique({ where: { id: coa_id } });
    if (coa === null || coa.verification_status !== 'pending') {
      logger.info({ coa_id }, 'OcrWorker: COA not found or not pending — skipping');
      return;
    }

    // Get the campaign's verification code
    const campaign = await prisma.campaign.findUnique({ where: { id: coa.campaign_id } });
    if (campaign === null) {
      logger.error({ coa_id }, 'OcrWorker: Campaign not found');
      return;
    }

    const result = await ocrService.processCoaPdf(coa.s3_key, campaign.verification_code);

    await prisma.coa.update({
      where: { id: coa_id },
      data: {
        ocr_text: result.text,
        verification_status: result.codeFound ? 'code_found' : 'code_not_found',
      },
    });

    logger.info({ coa_id, codeFound: result.codeFound }, 'OCR processing complete');
  });
}
