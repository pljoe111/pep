/**
 * LabController — spec §9.9
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Route,
  Tags,
  Body,
  Request,
  Security,
  Path,
  Query,
  OperationId,
} from 'tsoa';
import { LabService } from '../services/lab.service';
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
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('labs')
@Tags('Labs')
export class LabController extends Controller {
  constructor(@inject(LabService) private readonly labService: LabService) {
    super();
  }

  /** GET /labs */
  @Get('/')
  @OperationId('GetAllLabs')
  public async getAll(
    @Query() approved_only?: boolean,
    @Query() active_only?: boolean,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<LabDto>> {
    // Default to active only for campaign creation picker; admin can pass active_only=false
    const activeOnly = active_only !== undefined ? active_only : true;
    return this.labService.findAll(approved_only, activeOnly, page, limit);
  }

  /** GET /labs/:id */
  @Get('{id}')
  @OperationId('GetLabById')
  public async getById(@Path() id: string): Promise<LabDetailDto> {
    return this.labService.findById(id);
  }

  /** POST /labs — user_submitted_data_approver required */
  @Post('/')
  @Security('jwt')
  public async create(@Body() body: CreateLabDto, @Request() req: AuthRequest): Promise<LabDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.create(body, user.userId);
  }

  /** PATCH /labs/:id */
  @Patch('{id}')
  @Security('jwt')
  public async update(
    @Path() id: string,
    @Body() body: UpdateLabDto,
    @Request() req: AuthRequest
  ): Promise<LabDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.update(id, body, user.userId);
  }

  /** POST /labs/:id/approve */
  @Post('{id}/approve')
  @Security('jwt')
  public async approve(@Path() id: string, @Request() req: AuthRequest): Promise<LabDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.approve(id, user.userId);
  }

  /** POST /labs/:id/tests */
  @Post('{id}/tests')
  @Security('jwt')
  public async addTest(
    @Path() id: string,
    @Body() body: CreateLabTestDto,
    @Request() req: AuthRequest
  ): Promise<LabTestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.addTest(id, body, user.userId);
  }

  /** PATCH /labs/:id/tests/:testId */
  @Patch('{id}/tests/{testId}')
  @Security('jwt')
  public async updateTest(
    @Path() id: string,
    @Path() testId: string,
    @Body() body: UpdateLabTestDto,
    @Request() req: AuthRequest
  ): Promise<LabTestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.updateTest(id, testId, body, user.userId);
  }

  /** DELETE /labs/:id/tests/:testId — deactivates (soft delete) */
  @Delete('{id}/tests/{testId}')
  @Security('jwt')
  public deactivateTest(
    @Path() id: string,
    @Path() testId: string,
    @Request() req: AuthRequest
  ): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.deactivateTest(id, testId, user.userId);
  }

  /**
   * POST /labs/:id/tests/:testId/delete — permanently deletes a disabled lab-test record.
   * Guard: lab-test must already be inactive; fails with 409 if still active.
   */
  @Post('{id}/tests/{testId}/delete')
  @Security('jwt')
  @OperationId('PermanentDeleteLabTest')
  public permanentDeleteLabTest(
    @Path() id: string,
    @Path() testId: string,
    @Request() req: AuthRequest
  ): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.deleteLabTest(id, testId, user.userId);
  }

  /** DELETE /labs/:id — deactivates lab and all its tests (soft delete) */
  @Delete('{id}')
  @Security('jwt')
  public deactivateLab(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.deactivateLab(id, user.userId);
  }

  /**
   * POST /labs/:id/delete — permanently deletes the lab.
   * Guard: fails with 409 if any lab-test records (active or inactive) still exist.
   */
  @Post('{id}/delete')
  @Security('jwt')
  @OperationId('PermanentDeleteLab')
  public permanentDeleteLab(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.deleteLab(id, user.userId);
  }

  /** POST /labs/:id/reactivate */
  @Post('{id}/reactivate')
  @Security('jwt')
  public reactivateLab(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.reactivateLab(id, user.userId);
  }

  /** POST /labs/:id/tests/:testId/reactivate */
  @Post('{id}/tests/{testId}/reactivate')
  @Security('jwt')
  public reactivateLabTest(
    @Path() id: string,
    @Path() testId: string,
    @Request() req: AuthRequest
  ): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.labService.reactivateLabTest(id, testId, user.userId);
  }
}
