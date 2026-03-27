/**
 * TestService — test catalog management. Spec §9.10.
 */
import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotFoundError } from '../utils/errors';
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
}
