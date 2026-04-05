/**
 * PeptideService — normalized peptide catalog.
 * Users submit new peptides (is_active=false); admins approve/reject.
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import type { PeptideDto, PeptideSummaryDto, CreatePeptideDto, UpdatePeptideDto } from 'common';

function mapPeptide(p: {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  is_active: boolean;
  created_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
}): PeptideDto {
  return {
    id: p.id,
    name: p.name,
    aliases: p.aliases,
    description: p.description,
    is_active: p.is_active,
    created_by: p.created_by,
    approved_by: p.approved_by,
    approved_at: p.approved_at?.toISOString() ?? null,
    created_at: p.created_at.toISOString(),
  };
}

@injectable()
export class PeptideService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService,
    @inject(NotificationService) private readonly notifService: NotificationService
  ) {}

  /** Returns all active peptides for wizard in-memory cache. */
  async listActive(): Promise<PeptideSummaryDto[]> {
    const rows = await this.prisma.peptide.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, aliases: true, is_active: true },
    });
    return rows;
  }

  /** Admin: list all peptides (active + inactive). */
  async listAll(showUnreviewed = false): Promise<PeptideDto[]> {
    const where = showUnreviewed ? { is_active: false } : {};
    const rows = await this.prisma.peptide.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapPeptide);
  }

  /** User-submitted peptide — created with is_active=false, pending admin review. */
  async submit(dto: CreatePeptideDto, userId: string): Promise<PeptideDto> {
    const existing = await this.prisma.peptide.findUnique({ where: { name: dto.name } });
    if (existing !== null) {
      // If already exists and active, return it; if pending, surface it
      return mapPeptide(existing);
    }
    const peptide = await this.prisma.peptide.create({
      data: {
        name: dto.name,
        aliases: dto.aliases ?? [],
        description: dto.description ?? null,
        is_active: false,
        created_by: userId,
      },
    });
    this.audit.log({
      userId,
      action: 'peptide.submitted',
      entityType: 'peptide',
      entityId: peptide.id,
    });
    return mapPeptide(peptide);
  }

  /** Admin: create peptide directly (auto-approved). */
  async create(dto: CreatePeptideDto, userId: string): Promise<PeptideDto> {
    const existing = await this.prisma.peptide.findUnique({ where: { name: dto.name } });
    if (existing !== null) throw new ConflictError(`Peptide "${dto.name}" already exists`);
    const peptide = await this.prisma.peptide.create({
      data: {
        name: dto.name,
        aliases: dto.aliases ?? [],
        description: dto.description ?? null,
        is_active: true,
        created_by: userId,
        approved_by: userId,
        approved_at: new Date(),
      },
    });
    this.audit.log({
      userId,
      action: 'peptide.created',
      entityType: 'peptide',
      entityId: peptide.id,
    });
    return mapPeptide(peptide);
  }

  async update(peptideId: string, dto: UpdatePeptideDto, userId: string): Promise<PeptideDto> {
    const existing = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (existing === null) throw new NotFoundError('Peptide not found');
    const updated = await this.prisma.peptide.update({
      where: { id: peptideId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.aliases !== undefined ? { aliases: dto.aliases } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });
    this.audit.log({
      userId,
      action: 'peptide.updated',
      entityType: 'peptide',
      entityId: peptideId,
    });
    return mapPeptide(updated);
  }

  /** Admin: approve a pending peptide submission. */
  async approve(peptideId: string, adminId: string): Promise<PeptideDto> {
    const peptide = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (peptide === null) throw new NotFoundError('Peptide not found');
    if (peptide.is_active) throw new ConflictError('Peptide is already active');

    const updated = await this.prisma.peptide.update({
      where: { id: peptideId },
      data: { is_active: true, approved_by: adminId, approved_at: new Date() },
    });
    this.audit.log({
      userId: adminId,
      action: 'peptide.approved',
      entityType: 'peptide',
      entityId: peptideId,
    });

    // Notify submitter in-app
    await this.notifService.sendPeptideNotification(
      peptide.created_by,
      peptideId,
      'peptide_approved',
      peptide.name
    );

    return mapPeptide(updated);
  }

  /** Admin: reject (delete) a pending peptide submission. */
  async reject(peptideId: string, adminId: string): Promise<void> {
    const peptide = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (peptide === null) throw new NotFoundError('Peptide not found');
    if (peptide.is_active) throw new ConflictError('Cannot reject an already active peptide');

    // Notify submitter before deletion
    await this.notifService.sendPeptideNotification(
      peptide.created_by,
      peptideId,
      'peptide_rejected',
      peptide.name
    );

    await this.prisma.peptide.delete({ where: { id: peptideId } });
    this.audit.log({
      userId: adminId,
      action: 'peptide.rejected',
      entityType: 'peptide',
      entityId: peptideId,
    });
  }

  /** Admin: disable an active peptide (soft-deactivate). */
  async disable(peptideId: string, adminId: string): Promise<PeptideDto> {
    const peptide = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (peptide === null) throw new NotFoundError('Peptide not found');
    const updated = await this.prisma.peptide.update({
      where: { id: peptideId },
      data: { is_active: false },
    });
    this.audit.log({
      userId: adminId,
      action: 'peptide.disabled',
      entityType: 'peptide',
      entityId: peptideId,
    });
    return mapPeptide(updated);
  }

  /** Admin: enable a disabled peptide. */
  async enable(peptideId: string, adminId: string): Promise<PeptideDto> {
    const peptide = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (peptide === null) throw new NotFoundError('Peptide not found');
    const updated = await this.prisma.peptide.update({
      where: { id: peptideId },
      data: { is_active: true, approved_by: adminId, approved_at: new Date() },
    });
    this.audit.log({
      userId: adminId,
      action: 'peptide.enabled',
      entityType: 'peptide',
      entityId: peptideId,
    });
    return mapPeptide(updated);
  }

  /** Admin: hard-delete a disabled peptide (blocked if FK'd to samples). */
  async delete(peptideId: string, adminId: string): Promise<void> {
    const peptide = await this.prisma.peptide.findUnique({ where: { id: peptideId } });
    if (peptide === null) throw new NotFoundError('Peptide not found');
    const sampleCount = await this.prisma.sample.count({ where: { peptide_id: peptideId } });
    if (sampleCount > 0) {
      throw new ConflictError(
        `Cannot delete peptide: it is referenced by ${sampleCount} sample(s)`
      );
    }
    await this.prisma.peptide.delete({ where: { id: peptideId } });
    this.audit.log({
      userId: adminId,
      action: 'peptide.deleted',
      entityType: 'peptide',
      entityId: peptideId,
    });
  }
}
