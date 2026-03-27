/**
 * EmailWorker — sends transactional emails. Spec §10.4.
 * Concurrency: 10. Retries: 0 (informational; duplicates tolerable).
 */
import pino from 'pino';
import { container } from '../container';
import { emailQueue, type EmailJobPayload } from '../utils/queue.util';
import { EmailService } from '../services/email.service';

const logger = pino({ name: 'EmailWorker' });

export function startEmailWorker(): void {
  void emailQueue.process(10, async (job) => {
    const payload = job.data as EmailJobPayload;
    const emailService = container.resolve(EmailService);
    await emailService.send(payload);
    logger.debug({ to: payload.to, subject: payload.subject }, 'Email job processed');
  });
}
