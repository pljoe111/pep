/**
 * LabController — spec §9.9
 */
import { inject } from 'tsyringe';
import {
  Controller,
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
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<LabDto>> {
    return this.labService.findAll(approved_only, page, limit);
  }

  /** GET /labs/:id */
  @Get('{id}')
  @OperationId('GetLabById')
  public async getById(@Path() id: string): Promise<LabDetailDto> {
    return this.labService.findById(id);
  }

  /** POST /labs — lab_approver required */
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
}
