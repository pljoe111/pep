/**
 * TestService — test catalog management. Spec §9.10.
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import type { TestDto, CreateTestDto, UpdateTestDto } from 'common';

function mapTest(t: {
  id: string;
  name: string;
  description: string;
  usp_code: string | null;
  is_active: boolean;
  created_at: Date;
}): TestDto {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    usp_code: t.usp_code,
    is_active: t.is_active,
    created_at: t.created_at.toISOString(),
  };
}

@injectable()
export class TestService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(activeOnly = false): Promise<TestDto[]> {
    const where = activeOnly ? { is_active: true } : {};
    const rows = await this.prisma.test.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows.map(mapTest);
  }

  async create(dto: CreateTestDto, userId: string): Promise<TestDto> {
    const test = await this.prisma.test.create({
      data: {
        name: dto.name,
        description: dto.description,
        ...(dto.usp_code !== undefined ? { usp_code: dto.usp_code } : {}),
        created_by_user_id: userId,
      },
    });
    this.audit.log({ userId, action: 'test.created', entityType: 'test', entityId: test.id });
    return mapTest(test);
  }

  async update(testId: string, dto: UpdateTestDto, userId: string): Promise<TestDto> {
    const existing = await this.prisma.test.findUnique({ where: { id: testId } });
    if (existing === null) throw new NotFoundError('Test not found');

    const test = await this.prisma.test.update({
      where: { id: testId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        ...(dto.usp_code !== undefined ? { usp_code: dto.usp_code } : {}),
      },
    });
    this.audit.log({ userId, action: 'test.updated', entityType: 'test', entityId: test.id });
    return mapTest(test);
  }

  async disableTest(testId: string, userId: string): Promise<void> {
    const existing = await this.prisma.test.findUnique({ where: { id: testId } });
    if (existing === null) throw new NotFoundError('Test not found');
    if (!existing.is_active) return; // Already disabled

    // Disable all lab tests associated with this test
    await this.prisma.labTest.updateMany({
      where: { test_id: testId },
      data: { is_active: false },
    });

    // Disable the test itself
    await this.prisma.test.update({
      where: { id: testId },
      data: { is_active: false },
    });

    this.audit.log({ userId, action: 'test.disabled', entityType: 'test', entityId: testId });
  }

  async enableTest(testId: string, userId: string): Promise<void> {
    const existing = await this.prisma.test.findUnique({ where: { id: testId } });
    if (existing === null) throw new NotFoundError('Test not found');
    if (existing.is_active) return; // Already enabled

    await this.prisma.test.update({
      where: { id: testId },
      data: { is_active: true },
    });

    this.audit.log({ userId, action: 'test.enabled', entityType: 'test', entityId: testId });
  }

  /**
   * Hard-delete a test type.
   * Guard: blocked if any campaign TestRequest rows reference it (data integrity).
   * Cascade: all LabTest records (and their price history) for this test are
   * deleted first — no need to manually remove the test from each lab beforehand.
   */
  async deleteTest(testId: string, userId: string): Promise<void> {
    const existing = await this.prisma.test.findUnique({ where: { id: testId } });
    if (existing === null) throw new NotFoundError('Test not found');

    // Hard guard: campaign usage — cannot be deleted if referenced by test requests
    const requestCount = await this.prisma.testRequest.count({ where: { test_id: testId } });
    if (requestCount > 0) {
      throw new ConflictError(
        `Cannot delete test: ${requestCount} campaign test request(s) reference it.`
      );
    }

    // Cascade: remove price history rows then lab-test entries for every lab
    const labTests = await this.prisma.labTest.findMany({
      where: { test_id: testId },
      select: { id: true },
    });
    if (labTests.length > 0) {
      const labTestIds = labTests.map((lt) => lt.id);
      await this.prisma.labTestPriceHistory.deleteMany({
        where: { lab_test_id: { in: labTestIds } },
      });
      await this.prisma.labTest.deleteMany({ where: { test_id: testId } });
    }

    await this.prisma.test.delete({ where: { id: testId } });

    this.audit.log({ userId, action: 'test.deleted', entityType: 'test', entityId: testId });
  }
}
