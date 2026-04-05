/**
 * TestController — spec §9.10
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Route,
  Tags,
  Body,
  Request,
  Security,
  Path,
  Query,
  OperationId,
} from 'tsoa';
import { TestService } from '../services/test.service';
import type {
  TestDto,
  CreateTestDto,
  UpdateTestDto,
  TestClaimTemplateDto,
  CreateTestClaimTemplateDto,
  UpdateTestClaimTemplateDto,
} from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('tests')
@Tags('Tests')
export class TestController extends Controller {
  constructor(@inject(TestService) private readonly testService: TestService) {
    super();
  }

  /** GET /tests */
  @Get('/')
  @OperationId('GetAllTests')
  public async getAll(@Query() active_only?: boolean): Promise<TestDto[]> {
    return this.testService.findAll(active_only);
  }

  /** POST /tests — admin required */
  @Post('/')
  @Security('jwt')
  @OperationId('CreateTest')
  public async create(@Body() body: CreateTestDto, @Request() req: AuthRequest): Promise<TestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.create(body, user.userId);
  }

  /** PATCH /tests/:id — admin required */
  @Patch('{id}')
  @Security('jwt')
  @OperationId('UpdateTestRecord')
  public async update(
    @Path() id: string,
    @Body() body: UpdateTestDto,
    @Request() req: AuthRequest
  ): Promise<TestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.update(id, body, user.userId);
  }

  /** POST /tests/:id/disable — admin required */
  @Post('{id}/disable')
  @Security('jwt')
  @OperationId('DisableTest')
  public async disable(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.disableTest(id, user.userId);
  }

  /** POST /tests/:id/enable — admin required */
  @Post('{id}/enable')
  @Security('jwt')
  @OperationId('EnableTest')
  public async enable(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.enableTest(id, user.userId);
  }

  /**
   * DELETE /tests/:id — permanently deletes the test type.
   * Guard: fails with 409 if any lab-test records (active or inactive) reference it.
   * Disable the test and remove it from all labs before calling this.
   */
  @Delete('{id}')
  @Security('jwt')
  @OperationId('DeleteTest')
  public async deleteTest(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.deleteTest(id, user.userId);
  }

  /** GET /tests/:testId/claim-templates — list claim templates for a test */
  @Get('{testId}/claim-templates')
  @OperationId('GetTestClaimTemplates')
  public async getClaimTemplates(@Path() testId: string): Promise<TestClaimTemplateDto[]> {
    return this.testService.listClaimTemplates(testId);
  }

  /** POST /tests/:testId/claim-templates — create a new claim template */
  @Post('{testId}/claim-templates')
  @Security('jwt')
  @OperationId('CreateTestClaimTemplate')
  public async createClaimTemplate(
    @Path() testId: string,
    @Body() body: CreateTestClaimTemplateDto,
    @Request() req: AuthRequest
  ): Promise<TestClaimTemplateDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.createClaimTemplate(testId, body, user.userId);
  }

  /** PATCH /tests/claim-templates/:id — update a claim template */
  @Patch('/claim-templates/{id}')
  @Security('jwt')
  @OperationId('UpdateTestClaimTemplate')
  public async updateClaimTemplate(
    @Path() id: string,
    @Body() body: UpdateTestClaimTemplateDto,
    @Request() req: AuthRequest
  ): Promise<TestClaimTemplateDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.updateClaimTemplate(id, body, user.userId);
  }

  /** DELETE /tests/claim-templates/:id — delete a claim template */
  @Delete('/claim-templates/{id}')
  @Security('jwt')
  @OperationId('DeleteTestClaimTemplate')
  public async deleteClaimTemplate(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.testService.deleteClaimTemplate(id, user.userId);
  }
}
