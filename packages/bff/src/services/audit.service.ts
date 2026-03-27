/**
 * AuditService — writes append-only audit log rows.
 *
 * Per spec §4.24 and §1 design decision:
 *   - Called at the end of every state-mutating service method
 *   - Does NOT use the same DB transaction as the business operation
 *   - Fire-and-forget: failure must NEVER roll back a successful business tx
 *   - Logs on error but does not rethrow
 */
import { injectable, inject } from 'tsyringe';
import pino from 'pino';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const logger = pino({ name: 'AuditService' });

export interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}

@injectable()
export class AuditService {
  constructor(@inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget audit log write. Never throws. Failure is logged only.
   */
  log(params: AuditLogParams): void {
    const { userId, action, entityType, entityId, changes, ipAddress } = params;

    // Build the create data using UncheckedCreateInput so raw UUID fields are accepted.
    // SAFETY: changes is always a JSON-serializable object; the cast to InputJsonValue is valid.
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action,
      entity_type: entityType,
      entity_id: entityId,
      ...(userId !== undefined ? { user_id: userId } : {}),
      ...(changes !== undefined ? { changes: changes as Prisma.InputJsonValue } : {}),
      ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
    };

    this.prisma.auditLog.create({ data }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, action, entityType, entityId }, 'AuditService.log failed');
    });
  }
}
