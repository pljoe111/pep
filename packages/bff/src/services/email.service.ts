/**
 * EmailService — sends transactional emails via SMTP (Nodemailer).
 * Called by the email.worker.ts only. Not called directly by other services —
 * they enqueue to emailQueue instead.
 */
import { injectable } from 'tsyringe';
import nodemailer from 'nodemailer';
import pino from 'pino';
import { env } from '../config/env.config';

const logger = pino({ name: 'EmailService' });

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  /**
   * Send a single email. On failure: log warn, do NOT rethrow.
   * Per spec §10.4: retries = 0, duplicates tolerable.
   */
  async send(params: SendEmailParams): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      logger.info({ to: params.to, subject: params.subject }, 'Email sent');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message, to: params.to }, 'Email send failed — not retrying');
      // Do NOT rethrow — informational, duplicates tolerable (spec §10.4)
    }
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
