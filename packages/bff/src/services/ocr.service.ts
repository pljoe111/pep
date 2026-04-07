/**
 * OcrService — PDF text extraction and verification code searching.
 * Spec §7.12.1. Uses pdf-parse for text extraction.
 * Magic-byte validation is done in coa.service.ts before the OCR job is enqueued.
 */
import { injectable, inject } from 'tsyringe';
import pdfParse from 'pdf-parse';
import pino from 'pino';
import { StorageService } from './storage.service';

const logger = pino({ name: 'OcrService' });

export interface OcrResult {
  /** Full plain text extracted from the PDF */
  text: string;
  /** Whether the 6-digit verification code was found in the text */
  codeFound: boolean;
}

@injectable()
export class OcrService {
  constructor(@inject(StorageService) private readonly storageService: StorageService) {}

  /**
   * Download a PDF from S3, extract text, and search for the verification code.
   * The code must appear as a standalone numeric string (word boundary).
   * Spec §7.12.1.
   */
  async processCoaPdf(s3Key: string, verificationCode: number): Promise<OcrResult> {
    logger.info({ s3Key, verificationCode }, 'Starting OCR processing');

    const pdfBuffer = await this.storageService.download(s3Key);
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text ?? '';

    // Primary: digit-boundary lookarounds — robust against signed PDFs where
    // pdf-parse may produce "B260220833460" (no space between chars) that breaks \b.
    const strictPattern = new RegExp(`(?<!\\d)${verificationCode}(?!\\d)`);

    // Fallback: strip all non-digit characters and search the resulting digit-only
    // string. Catches PDFs where glyphs are extracted without any separators at all.
    const digitsOnly = text.replace(/\D/g, '');
    const codeStr = String(verificationCode);
    const fallbackFound = digitsOnly.includes(codeStr);

    const codeFound = strictPattern.test(text) || fallbackFound;

    logger.info({ s3Key, codeFound, textLength: text.length }, 'OCR processing complete');

    return { text, codeFound };
  }
}
