/**
 * AdminController — spec §9.12
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Get,
  Post,
  Put,
  Route,
  Tags,
  Body,
  Request,
  Security,
  Path,
  Query,
} from 'tsoa';
import { AdminService } from '../services/admin.service';
import { ConsolidationService } from '../workers/consolidation.worker';
import type {
  CampaignDetailDto,
  UserDto,
  ConfigurationDto,
  FeeSweepResponseDto,
  ConsolidationResponseDto,
  CoaDto,
  AdminRefundDto,
  AdminHideCampaignDto,
  AdminFlagCampaignDto,
  AdminBanUserDto,
  AdminClaimDto,
  AdminVerifyCoaDto,
  AdminUpdateConfigDto,
  AdminFeeSweepDto,
  PaginatedResponseDto,
} from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('admin')
@Tags('Admin')
@Security('jwt')
export class AdminController extends Controller {
  constructor(
    @inject(AdminService) private readonly adminService: AdminService,
    @inject(ConsolidationService)
    private readonly consolidationService: ConsolidationService
  ) {
    super();
  }

  /** GET /admin/campaigns */
  @Get('campaigns')
  public async getCampaigns(
    @Query() status?: string,
    @Query() flagged?: boolean,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<CampaignDetailDto>> {
    return this.adminService.getCampaigns(status, flagged, page, limit);
  }

  /** POST /admin/campaigns/:id/refund */
  @Post('campaigns/{id}/refund')
  public async refundCampaign(
    @Path() id: string,
    @Body() body: AdminRefundDto,
    @Request() req: AuthRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.forceRefund(user.userId, id, body.reason);
  }

  /** POST /admin/campaigns/:id/flag */
  @Post('campaigns/{id}/flag')
  public async flagCampaign(
    @Path() id: string,
    @Body() body: AdminFlagCampaignDto,
    @Request() req: AuthRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.flagCampaign(user.userId, id, body.flagged, body.reason);
  }

  /** POST /admin/campaigns/:id/hide */
  @Post('campaigns/{id}/hide')
  public async hideCampaign(
    @Path() id: string,
    @Body() body: AdminHideCampaignDto,
    @Request() req: AuthRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.hideCampaign(user.userId, id, body.hidden);
  }

  /** POST /admin/coas/:id/verify */
  @Post('coas/{id}/verify')
  public async verifyCoa(
    @Path() id: string,
    @Body() body: AdminVerifyCoaDto,
    @Request() req: AuthRequest
  ): Promise<CoaDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.verifyCoa(user.userId, id, body);
  }

  /** GET /admin/users */
  @Get('users')
  public async getUsers(
    @Query() search?: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<UserDto>> {
    return this.adminService.getUsers(search, page, limit);
  }

  /** POST /admin/users/:id/ban */
  @Post('users/{id}/ban')
  public async banUser(
    @Path() id: string,
    @Body() body: AdminBanUserDto,
    @Request() req: AuthRequest
  ): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.banUser(user.userId, id, body);
  }

  /** POST /admin/users/:id/claims */
  @Post('users/{id}/claims')
  public async manageClaim(
    @Path() id: string,
    @Body() body: AdminClaimDto,
    @Request() req: AuthRequest
  ): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.manageClaim(user.userId, id, body);
  }

  /** GET /admin/config */
  @Get('config')
  public async getConfig(): Promise<ConfigurationDto[]> {
    return this.adminService.getConfig();
  }

  /** PUT /admin/config/:key */
  @Put('config/{key}')
  public async updateConfig(
    @Path() key: string,
    @Body() body: AdminUpdateConfigDto,
    @Request() req: AuthRequest
  ): Promise<ConfigurationDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.updateConfig(user.userId, key, body.value);
  }

  /** POST /admin/fee-sweep */
  @Post('fee-sweep')
  public async sweepFees(
    @Body() body: AdminFeeSweepDto,
    @Request() req: AuthRequest
  ): Promise<FeeSweepResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.adminService.sweepFees(user.userId, body);
  }

  /**
   * POST /admin/consolidate — swap USDC → USDT on master wallet via Jupiter.
   * Only executes if USDC balance >= CONSOLIDATION_THRESHOLD_USDC.
   * Requires admin claim.
   */
  @Post('consolidate')
  public async triggerConsolidation(
    @Request() req: AuthRequest
  ): Promise<ConsolidationResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.consolidationService.consolidate(user.userId);
  }
}
