/**
 * LabService — spec §9.9 (Lab CRUD, approval, adding tests to labs).
 */
import { injectable, inject } from 'tsyringe';
import type { Lab } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import type {
  LabDto,
  LabDetailDto,
  LabTestDto,
  CreateLabDto,
  UpdateLabDto,
  CreateLabTestDto,
  UpdateLabTestDto,
  PaginatedResponseDto,
} from 'common';

function mapLab(lab: {
  id: string;
  name: string;
  phone_number: string | null;
  country: string;
  address: string | null;
  is_approved: boolean;
  approved_at: Date | null;
  created_at: Date;
}): LabDto {
  return {
    id: lab.id,
    name: lab.name,
    phone_number: lab.phone_number,
    country: lab.country,
    address: lab.address,
    is_approved: lab.is_approved,
    approved_at: lab.approved_at?.toISOString() ?? null,
    created_at: lab.created_at.toISOString(),
  };
}

@injectable()
export class LabService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(approvedOnly = false, page = 1, limit = 20): Promise<PaginatedResponseDto<LabDto>> {
    const skip = (page - 1) * limit;
    const where = approvedOnly ? { is_approved: true } : {};
    const [rows, total] = await Promise.all([
      this.prisma.lab.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.lab.count({ where }),
    ]);
    return { data: rows.map(mapLab), total, page, limit };
  }

  async findById(labId: string): Promise<LabDetailDto> {
    const lab = await this.prisma.lab.findUnique({ where: { id: labId } });
    if (lab === null) throw new NotFoundError('Lab not found');

    const labTests = await this.prisma.labTest.findMany({
      where: { lab_id: labId },
      orderBy: { created_at: 'asc' },
    });

    const testIds = labTests.map((lt) => lt.test_id);
    const tests =
      testIds.length > 0 ? await this.prisma.test.findMany({ where: { id: { in: testIds } } }) : [];

    const testMap = new Map(tests.map((t) => [t.id, t.name]));

    return {
      ...mapLab(lab),
      tests: labTests.map((lt) => ({
        id: lt.id,
        lab_id: lt.lab_id,
        test_id: lt.test_id,
        test_name: testMap.get(lt.test_id) ?? '',
        price_usd: Number(lt.price_usd),
        typical_turnaround_days: lt.typical_turnaround_days,
      })),
    };
  }

  async create(dto: CreateLabDto, userId: string): Promise<LabDto> {
    const lab = await this.prisma.lab.create({
      data: {
        name: dto.name,
        ...(dto.phone_number !== undefined ? { phone_number: dto.phone_number } : {}),
        country: dto.country,
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
    this.audit.log({ userId, action: 'lab.created', entityType: 'lab', entityId: lab.id });
    return mapLab(lab);
  }

  async update(labId: string, dto: UpdateLabDto, userId: string): Promise<LabDto> {
    await this.findOne(labId);
    const lab = await this.prisma.lab.update({
      where: { id: labId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone_number !== undefined ? { phone_number: dto.phone_number } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
    this.audit.log({ userId, action: 'lab.updated', entityType: 'lab', entityId: lab.id });
    return mapLab(lab);
  }

  async approve(labId: string, userId: string): Promise<LabDto> {
    const existing = await this.findOne(labId);
    if (existing.is_approved) throw new ConflictError('Lab is already approved');
    const lab = await this.prisma.lab.update({
      where: { id: labId },
      data: { is_approved: true, approved_by_user_id: userId, approved_at: new Date() },
    });
    this.audit.log({ userId, action: 'lab.approved', entityType: 'lab', entityId: lab.id });
    return mapLab(lab);
  }

  async addTest(labId: string, dto: CreateLabTestDto, userId: string): Promise<LabTestDto> {
    await this.findOne(labId);
    const test = await this.prisma.test.findUnique({ where: { id: dto.test_id } });
    if (test === null) throw new NotFoundError('Test not found');

    const existing = await this.prisma.labTest.findUnique({
      where: { lab_id_test_id: { lab_id: labId, test_id: dto.test_id } },
    });
    if (existing !== null) throw new ConflictError('This test is already added to this lab');

    const labTest = await this.prisma.labTest.create({
      data: {
        lab_id: labId,
        test_id: dto.test_id,
        price_usd: dto.price_usd,
        typical_turnaround_days: dto.typical_turnaround_days,
      },
    });

    // Seed initial price history
    await this.prisma.labTestPriceHistory.create({
      data: {
        lab_test_id: labTest.id,
        price_usd: labTest.price_usd,
        changed_by_user_id: userId,
        change_reason: 'Initial price',
      },
    });

    this.audit.log({
      userId,
      action: 'lab_test.created',
      entityType: 'lab_test',
      entityId: labTest.id,
    });

    return {
      id: labTest.id,
      lab_id: labTest.lab_id,
      test_id: labTest.test_id,
      test_name: test.name,
      price_usd: Number(labTest.price_usd),
      typical_turnaround_days: labTest.typical_turnaround_days,
    };
  }

  async updateTest(
    labId: string,
    testId: string,
    dto: UpdateLabTestDto,
    userId: string
  ): Promise<LabTestDto> {
    const labTest = await this.prisma.labTest.findUnique({
      where: { lab_id_test_id: { lab_id: labId, test_id: testId } },
    });
    if (labTest === null) throw new NotFoundError('Lab test not found');

    if (dto.price_usd !== undefined && dto.price_usd !== Number(labTest.price_usd)) {
      // Update price history: close previous, insert new (spec §9.9)
      await this.prisma.labTestPriceHistory.updateMany({
        where: { lab_test_id: labTest.id, effective_to: null },
        data: { effective_to: new Date() },
      });
      await this.prisma.labTestPriceHistory.create({
        data: {
          lab_test_id: labTest.id,
          price_usd: dto.price_usd,
          changed_by_user_id: userId,
          ...(dto.change_reason !== undefined ? { change_reason: dto.change_reason } : {}),
        },
      });
    }

    const updated = await this.prisma.labTest.update({
      where: { lab_id_test_id: { lab_id: labId, test_id: testId } },
      data: {
        ...(dto.price_usd !== undefined ? { price_usd: dto.price_usd } : {}),
        ...(dto.typical_turnaround_days !== undefined
          ? { typical_turnaround_days: dto.typical_turnaround_days }
          : {}),
      },
    });

    const test = await this.prisma.test.findUniqueOrThrow({ where: { id: testId } });
    this.audit.log({
      userId,
      action: 'lab_test.updated',
      entityType: 'lab_test',
      entityId: labTest.id,
    });

    return {
      id: updated.id,
      lab_id: updated.lab_id,
      test_id: updated.test_id,
      test_name: test.name,
      price_usd: Number(updated.price_usd),
      typical_turnaround_days: updated.typical_turnaround_days,
    };
  }

  private async findOne(labId: string): Promise<Lab> {
    const lab = await this.prisma.lab.findUnique({ where: { id: labId } });
    if (lab === null) throw new NotFoundError('Lab not found');
    return lab;
  }
}
