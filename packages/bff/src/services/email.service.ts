/**
 * EmailService — sends transactional emails via configurable providers.
 * Called by the email.worker.ts only. Not called directly by other services —
 * they enqueue to emailQueue instead.
 *
 * Supports two delivery providers:
 * - Nodemailer: Traditional SMTP-based delivery
 * - Resend: Modern API-based delivery with better deliverability
 */
import { injectable } from 'tsyringe';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import pino from 'pino';
import { env } from '../config/env.config';

const logger = pino({ name: 'EmailService' });

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Define type for nodemailer result
interface NodemailerResult {
  messageId: string;
  envelope: Record<string, unknown>;
  accepted: string[];
  rejected: string[];
  response: string;
}

// Provider interfaces
interface EmailProvider {
  send(params: SendEmailParams): Promise<void>;
}

class NodemailerProvider implements EmailProvider {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    // Log the SMTP configuration for debugging
    logger.info(
      {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        user: env.SMTP_USER ? `${env.SMTP_USER.substring(0, 5)}...` : undefined, // Only log prefix of username for security
        auth: env.SMTP_USER && env.SMTP_PASS ? 'provided' : 'missing',
      },
      'Initializing Nodemailer with configuration'
    );

    // Create transporter with explicit secure:true for port 465
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: true, // Always use SSL for port 465
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      // Add debug option in development
      ...(env.NODE_ENV === 'development' ? { debug: true } : {}),
    });

    // Verify SMTP connection on startup
    // Handle the promise without waiting (fire and forget)
    void this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'SMTP connection verification failed');
    }
  }

  async send(params: SendEmailParams): Promise<void> {
    try {
      logger.debug(
        {
          from: env.EMAIL_FROM,
          to: params.to,
          subject: params.subject,
        },
        'Attempting to send email via Nodemailer'
      );

      // Send mail with defined transport object
      const info = (await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      })) as Partial<NodemailerResult>;

      logger.info(
        {
          to: params.to,
          subject: params.subject,
          provider: 'nodemailer',
          messageId: info.messageId || 'unknown',
        },
        'Email sent successfully via Nodemailer'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        {
          error: message,
          to: params.to,
          provider: 'nodemailer',
          fromAddress: env.EMAIL_FROM,
          smtpHost: env.SMTP_HOST,
          smtpPort: env.SMTP_PORT,
          smtpUser: env.SMTP_USER ? `${env.SMTP_USER.substring(0, 5)}...` : undefined, // Only log prefix of username for security
        },
        'Email send failed — not retrying'
      );
      // Do NOT rethrow — informational, duplicates tolerable (spec §10.4)
    }
  }
}

class ResendProvider implements EmailProvider {
  private readonly client: Resend;

  constructor() {
    logger.info({ apiKeyLength: env.RESEND_API_KEY?.length || 0 }, 'Initializing Resend client');
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async send(params: SendEmailParams): Promise<void> {
    try {
      logger.debug(
        {
          from: env.EMAIL_FROM,
          to: params.to,
          subject: params.subject,
        },
        'Attempting to send email via Resend'
      );

      const result = await this.client.emails.send({
        from: env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (result.error) {
        throw new Error(`Resend API error: ${result.error.message || 'Unknown error'}`);
      }

      logger.info(
        {
          id: result.data?.id,
          to: params.to,
          subject: params.subject,
          provider: 'resend',
        },
        'Email sent successfully via Resend'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        {
          error: message,
          to: params.to,
          provider: 'resend',
          fromAddress: env.EMAIL_FROM,
        },
        'Resend email send failed — not retrying'
      );

      // Log additional troubleshooting information
      logger.warn(
        {
          apiKeyPresent: Boolean(env.RESEND_API_KEY),
          apiKeyPrefix: env.RESEND_API_KEY?.substring(0, 5),
        },
        'Resend configuration troubleshooting info'
      );

      // Do NOT rethrow — informational, duplicates tolerable (spec §10.4)
    }
  }
}

@injectable()
export class EmailService {
  private readonly provider: EmailProvider;

  constructor() {
    // Initialize the configured email provider
    if (env.EMAIL_PROVIDER === 'resend') {
      this.provider = new ResendProvider();
      logger.info('Email service initialized with Resend provider');
    } else {
      this.provider = new NodemailerProvider();
      logger.info('Email service initialized with Nodemailer provider');
    }
  }

  /**
   * Send a single email. On failure: log warn, do NOT rethrow.
   * Per spec §10.4: retries = 0, duplicates tolerable.
   */
  async send(params: SendEmailParams): Promise<void> {
    await this.provider.send(params);
  }

  /**
   * Send an operator alert email (used by reconciliation job on discrepancy).
   */
  async sendOperatorAlert(subject: string, body: string): Promise<void> {
    await this.send({
      to: env.OPERATOR_ALERT_EMAIL,
      subject,
      html: `<pre>${body}</pre>`,
      text: body,
    });
  }
}
