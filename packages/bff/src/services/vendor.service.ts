/**
 * VendorService — normalized vendor registry.
 * Vendors submitted by users default to `pending`; admins approve/reject.
 * `pending` vendors are usable in campaigns but shown as "⚠ Unverified".
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import type {
  VendorDto,
  VendorSummaryDto,
  CreateVendorDto,
  UpdateVendorDto,
  ReviewVendorDto,
} from 'common';

function mapVendor(v: {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  telegram_group: string | null;
  contact_notes: string | null;
  status: string;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  created_at: Date;
  updated_at: Date;
}): VendorDto {
  return {
    id: v.id,
    name: v.name,
    website: v.website,
    country: v.country,
    telegram_group: v.telegram_group,
    contact_notes: v.contact_notes,
    status: v.status as VendorDto['status'],
    submitted_by: v.submitted_by,
    reviewed_by: v.reviewed_by,
    reviewed_at: v.reviewed_at?.toISOString() ?? null,
    review_notes: v.review_notes,
    created_at: v.created_at.toISOString(),
    updated_at: v.updated_at.toISOString(),
  };
}

@injectable()
export class VendorService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService
  ) {}

  /**
   * Search vendors by name fragment — used by wizard combobox (debounced).
   * Returns only non-rejected vendors.
   */
  async search(q: string, limit = 10): Promise<VendorSummaryDto[]> {
    const rows = await this.prisma.vendor.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        status: { not: 'rejected' },
      },
      orderBy: { name: 'asc' },
      take: limit,
      select: { id: true, name: true, website: true, country: true, status: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      website: r.website,
      country: r.country,
      status: r.status as VendorSummaryDto['status'],
    }));
  }

  /** Admin: list all vendors with optional status filter. */
  async listAll(status?: 'pending' | 'approved' | 'rejected'): Promise<VendorDto[]> {
    const where = status !== undefined ? { status } : {};
    const rows = await this.prisma.vendor.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapVendor);
  }

  async findById(vendorId: string): Promise<VendorDto> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (vendor === null) throw new NotFoundError('Vendor not found');
    return mapVendor(vendor);
  }

  /** User-submitted vendor — defaults to pending. */
  async submit(dto: CreateVendorDto, userId: string): Promise<VendorDto> {
    const existing = await this.prisma.vendor.findUnique({ where: { name: dto.name } });
    if (existing !== null) {
      // Already exists — return it regardless of status
      return mapVendor(existing);
    }
    const vendor = await this.prisma.vendor.create({
      data: {
        name: dto.name,
        website: dto.website ?? null,
        country: dto.country ?? null,
        telegram_group: dto.telegram_group ?? null,
        contact_notes: dto.contact_notes ?? null,
        status: 'pending',
        submitted_by: userId,
      },
    });
    this.audit.log({
      userId,
      action: 'vendor.submitted',
      entityType: 'vendor',
      entityId: vendor.id,
    });
    return mapVendor(vendor);
  }

  /** Admin: create vendor directly (auto-approved). */
  async create(dto: CreateVendorDto, userId: string): Promise<VendorDto> {
    const existing = await this.prisma.vendor.findUnique({ where: { name: dto.name } });
    if (existing !== null) throw new ConflictError(`Vendor "${dto.name}" already exists`);
    const vendor = await this.prisma.vendor.create({
      data: {
        name: dto.name,
        website: dto.website ?? null,
        country: dto.country ?? null,
        telegram_group: dto.telegram_group ?? null,
        contact_notes: dto.contact_notes ?? null,
        status: 'approved',
        submitted_by: userId,
        reviewed_by: userId,
        reviewed_at: new Date(),
      },
    });
    this.audit.log({
      userId,
      action: 'vendor.created',
      entityType: 'vendor',
      entityId: vendor.id,
    });
    return mapVendor(vendor);
  }

  async update(vendorId: string, dto: UpdateVendorDto, userId: string): Promise<VendorDto> {
    const existing = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (existing === null) throw new NotFoundError('Vendor not found');
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.telegram_group !== undefined ? { telegram_group: dto.telegram_group } : {}),
        ...(dto.contact_notes !== undefined ? { contact_notes: dto.contact_notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    this.audit.log({
      userId,
      action: 'vendor.updated',
      entityType: 'vendor',
      entityId: vendorId,
    });
    return mapVendor(updated);
  }

  /** Admin: approve or reject a vendor. */
  async review(vendorId: string, dto: ReviewVendorDto, adminId: string): Promise<VendorDto> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (vendor === null) throw new NotFoundError('Vendor not found');

    if (dto.status === 'approved' && vendor.status === 'approved') {
      throw new ConflictError('Vendor is already approved');
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: dto.status,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        review_notes: dto.review_notes ?? null,
      },
    });
    this.audit.log({
      userId: adminId,
      action: `vendor.${dto.status}`,
      entityType: 'vendor',
      entityId: vendorId,
    });
    return mapVendor(updated);
  }

  /** Admin: suspend (set rejected) with optional note. */
  async suspend(vendorId: string, note: string | undefined, adminId: string): Promise<VendorDto> {
    return this.review(vendorId, { status: 'rejected', review_notes: note }, adminId);
  }

  /** Admin: reinstate (set approved). */
  async reinstate(vendorId: string, adminId: string): Promise<VendorDto> {
    return this.review(vendorId, { status: 'approved' }, adminId);
  }

  /**
   * Admin: hard-delete. Blocked if vendor has attached samples.
   * Returns active campaign count for warning display.
   */
  async delete(vendorId: string, adminId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (vendor === null) throw new NotFoundError('Vendor not found');
    const sampleCount = await this.prisma.sample.count({ where: { vendor_id: vendorId } });
    if (sampleCount > 0) {
      throw new ConflictError(`Cannot delete vendor: it is referenced by ${sampleCount} sample(s)`);
    }
    await this.prisma.vendor.delete({ where: { id: vendorId } });
    this.audit.log({
      userId: adminId,
      action: 'vendor.deleted',
      entityType: 'vendor',
      entityId: vendorId,
    });
  }

  /** Count active campaigns using this vendor — for rejection/suspension warning. */
  async countActiveCampaigns(vendorId: string): Promise<number> {
    const activeStatuses = ['created', 'funded', 'samples_sent', 'results_published'];
    return this.prisma.campaign.count({
      where: {
        status: { in: activeStatuses as never[] },
        samples: { some: { vendor_id: vendorId } },
      },
    });
  }
}
