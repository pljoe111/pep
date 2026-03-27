/**
 * StorageService — S3 / S3-compatible (MinIO) file storage.
 * COA PDFs only. Private bucket. file_url in DB is the S3 object key.
 * All file_url responses return pre-signed URLs generated at read time.
 * Spec §1 design decisions: S3 file access.
 */
import { injectable } from 'tsyringe';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pino from 'pino';
import { env } from '../config/env.config';

const logger = pino({ name: 'StorageService' });

@injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.AWS_S3_BUCKET;
    this.s3 = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      ...(env.AWS_S3_ENDPOINT ? { endpoint: env.AWS_S3_ENDPOINT, forcePathStyle: true } : {}),
    });
  }

  /**
   * Upload a file buffer. Returns the S3 object key.
   * Key format: coas/{campaignId}/{sampleId}/{timestamp}.pdf
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    logger.info({ key }, 'File uploaded to S3');
  }

  /**
   * Download a file by S3 key. Returns the file as a Buffer.
   */
  async download(key: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));

    if (!response.Body) {
      throw new Error(`S3 object body is empty for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete an object by key.
   */
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    logger.info({ key }, 'File deleted from S3');
  }

  /**
   * Generate a pre-signed URL with the configured TTL.
   * All API responses that expose file URLs use this — never the raw key.
   */
  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, {
      expiresIn: env.S3_SIGNED_URL_TTL_SECONDS,
    });
  }
}
