/**
 * TestService — test catalog management. Spec §9.10.
 * Extended with vials_required and TestClaimTemplate CRUD.
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import type {
  TestDto,
  TestClaimTemplateDto,
  CreateTestDto,
  UpdateTestDto,
  CreateTestClaimTemplateDto,
  UpdateTestClaimTemplateDto,
} from 'common';

function mapClaimTemplate(t: {
  id: string;
  test_id: string;
  claim_kind: string;
  label: string;
  is_required: boolean;
  sort_order: number;
}): TestClaimTemplateDto {
  return {
    id: t.id,
    test_id: t.test_id,
    claim_kind: t.claim_kind as TestClaimTemplateDto['claim_kind'],
    label: t.label,
    is_required: t.is_required,
    sort_order: t.sort_order,
  };
}

function mapTest(
  t: {
    id: string;
    name: string;
    description: string;
    usp_code: string | null;
    is_active: boolean;
    vials_required: number;
    created_at: Date;
  },
  claimTemplates: TestClaimTemplateDto[] = []
): TestDto {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    usp_code: t.usp_code,
    is_active: t.is_active,
    vials_required: t.vials_required,
    created_at: t.created_at.toISOString(),
    claim_templates: claimTemplates,
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
      include: { claimTemplates: { orderBy: { sort_order: 'asc' } } },
    });
    return rows.map((r) => mapTest(r, r.claimTemplates.map(mapClaimTemplate)));
  }

  async create(dto: CreateTestDto, userId: string): Promise<TestDto> {
    const test = await this.prisma.test.create({
      data: {
        name: dto.name,
        description: dto.description,
        ...(dto.usp_code !== undefined ? { usp_code: dto.usp_code } : {}),
        ...(dto.vials_required !== undefined ? { vials_required: dto.vials_required } : {}),
        created_by_user_id: userId,
      },
      include: { claimTemplates: { orderBy: { sort_order: 'asc' } } },
    });
    this.audit.log({ userId, action: 'test.created', entityType: 'test', entityId: test.id });
    return mapTest(test, test.claimTemplates.map(mapClaimTemplate));
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
        ...(dto.vials_required !== undefined ? { vials_required: dto.vials_required } : {}),
      },
      include: { claimTemplates: { orderBy: { sort_order: 'asc' } } },
    });
    this.audit.log({ userId, action: 'test.updated', entityType: 'test', entityId: test.id });
    return mapTest(test, test.claimTemplates.map(mapClaimTemplate));
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

  // ─── TestClaimTemplate CRUD ───────────────────────────────────────────────

  async listClaimTemplates(testId: string): Promise<TestClaimTemplateDto[]> {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (test === null) throw new NotFoundError('Test not found');
    const rows = await this.prisma.testClaimTemplate.findMany({
      where: { test_id: testId },
      orderBy: { sort_order: 'asc' },
    });
    return rows.map(mapClaimTemplate);
  }

  async createClaimTemplate(
    testId: string,
    dto: CreateTestClaimTemplateDto,
    userId: string
  ): Promise<TestClaimTemplateDto> {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (test === null) throw new NotFoundError('Test not found');

    const existing = await this.prisma.testClaimTemplate.findUnique({
      where: { test_id_claim_kind: { test_id: testId, claim_kind: dto.claim_kind } },
    });
    if (existing !== null) {
      throw new ConflictError(
        `A claim template for "${dto.claim_kind}" already exists on this test`
      );
    }

    const template = await this.prisma.testClaimTemplate.create({
      data: {
        test_id: testId,
        claim_kind: dto.claim_kind,
        label: dto.label,
        is_required: dto.is_required ?? false,
        sort_order: dto.sort_order ?? 0,
      },
    });
    this.audit.log({
      userId,
      action: 'test_claim_template.created',
      entityType: 'test_claim_template',
      entityId: template.id,
    });
    return mapClaimTemplate(template);
  }

  async updateClaimTemplate(
    templateId: string,
    dto: UpdateTestClaimTemplateDto,
    userId: string
  ): Promise<TestClaimTemplateDto> {
    const template = await this.prisma.testClaimTemplate.findUnique({
      where: { id: templateId },
    });
    if (template === null) throw new NotFoundError('Claim template not found');

    const updated = await this.prisma.testClaimTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.is_required !== undefined ? { is_required: dto.is_required } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
      },
    });
    this.audit.log({
      userId,
      action: 'test_claim_template.updated',
      entityType: 'test_claim_template',
      entityId: templateId,
    });
    return mapClaimTemplate(updated);
  }

  async deleteClaimTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.prisma.testClaimTemplate.findUnique({
      where: { id: templateId },
    });
    if (template === null) throw new NotFoundError('Claim template not found');
    if (template.is_required) {
      throw new ConflictError('Cannot delete a required claim template');
    }
    await this.prisma.testClaimTemplate.delete({ where: { id: templateId } });
    this.audit.log({
      userId,
      action: 'test_claim_template.deleted',
      entityType: 'test_claim_template',
      entityId: templateId,
    });
  }
}
