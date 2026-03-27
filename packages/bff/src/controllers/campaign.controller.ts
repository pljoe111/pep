/**
 * CampaignController — spec §9.3, §9.4, §9.5, §9.6, §9.13
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
  SuccessResponse,
  UploadedFile,
  OperationId,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { CampaignService } from '../services/campaign.service';
import { ContributionService } from '../services/contribution.service';
import type {
  CreateCampaignDto,
  UpdateCampaignDto,
  ContributeDto,
  AddCampaignUpdateDto,
  AddReactionDto,
  CampaignDetailDto,
  CampaignListDto,
  CampaignUpdateDto,
  ReactionCountsDto,
  ContributionDto,
  CoaDto,
  EstimateCostResponseDto,
  VerificationCodeResponseDto,
  PaginatedResponseDto,
} from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';
import { CoaService } from '../services/coa.service';

@Route('campaigns')
@Tags('Campaigns')
export class CampaignController extends Controller {
  constructor(
    @inject(CampaignService) private readonly campaignService: CampaignService,
    @inject(ContributionService) private readonly contributionService: ContributionService,
    @inject(CoaService) private readonly coaService: CoaService
  ) {
    super();
  }

  // ─── GET /campaigns/estimate-cost ────────────────────────────────────────
  /** GET /campaigns/estimate-cost — spec §9.13 */
  @Get('estimate-cost')
  @Security('jwt')
  public async estimateCost(@Query() samples: string): Promise<EstimateCostResponseDto> {
    return this.campaignService.estimateCost(samples);
  }

  // ─── GET /campaigns/verification-code ────────────────────────────────────
  /** GET /campaigns/verification-code — spec §9.13 (preview only; 5 req/min per user) */
  @Get('verification-code')
  @Security('jwt')
  public getVerificationCode(): VerificationCodeResponseDto {
    return { code: this.campaignService.generatePreviewVerificationCode() };
  }

  // ─── GET /campaigns/me ────────────────────────────────────────────────────
  /** GET /campaigns/me — creator's own campaigns */
  @Get('me')
  @Security('jwt')
  public async getMyCampaigns(
    @Request() req: ExpressRequest,
    @Query() page?: number,
    @Query() limit?: number,
    @Query() status?: string
  ): Promise<PaginatedResponseDto<CampaignListDto>> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.findMyCampaignsByUser(user.userId, page, limit, status);
  }

  // ─── GET /campaigns ───────────────────────────────────────────────────────
  /** GET /campaigns — public listing */
  @Get('/')
  @OperationId('GetAllCampaigns')
  public async getAll(
    @Request() req: ExpressRequest,
    @Query() status?: string,
    @Query() search?: string,
    @Query() sort?: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<CampaignListDto>> {
    const user = req.user;
    const isAdmin = user?.claims?.includes('admin') ?? false;
    return this.campaignService.findAll(status, search, sort, page, limit, isAdmin);
  }

  // ─── POST /campaigns ──────────────────────────────────────────────────────
  /** POST /campaigns — JWT (campaign_creator) */
  @Post('/')
  @Security('jwt')
  @SuccessResponse(201, 'Created')
  public async createCampaign(
    @Body() body: CreateCampaignDto,
    @Request() req: ExpressRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    this.setStatus(201);
    return this.campaignService.createCampaign(user.userId, body);
  }

  // ─── GET /campaigns/:id ───────────────────────────────────────────────────
  /** GET /campaigns/:id — public with optional JWT */
  @Get('{id}')
  @OperationId('GetCampaignById')
  public async getById(
    @Path() id: string,
    @Request() req: ExpressRequest
  ): Promise<CampaignDetailDto> {
    const user = req.user;
    return this.campaignService.getCampaignDetail(id, user?.userId);
  }

  // ─── PATCH /campaigns/:id ─────────────────────────────────────────────────
  /** PATCH /campaigns/:id — JWT (own, status=created) */
  @Patch('{id}')
  @Security('jwt')
  public async updateCampaign(
    @Path() id: string,
    @Body() body: UpdateCampaignDto,
    @Request() req: ExpressRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.updateCampaign(user.userId, id, body);
  }

  // ─── DELETE /campaigns/:id ────────────────────────────────────────────────
  /** DELETE /campaigns/:id — JWT (own) */
  @Delete('{id}')
  @Security('jwt')
  @SuccessResponse(204, 'No Content')
  public async deleteCampaign(@Path() id: string, @Request() req: ExpressRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    await this.campaignService.deleteCampaign(user.userId, id);
    this.setStatus(204);
  }

  // ─── POST /campaigns/:id/lock ─────────────────────────────────────────────
  /** POST /campaigns/:id/lock — JWT (own) */
  @Post('{id}/lock')
  @Security('jwt')
  public async lockCampaign(
    @Path() id: string,
    @Request() req: ExpressRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.lockCampaign(user.userId, id);
  }

  // ─── POST /campaigns/:id/ship-samples ────────────────────────────────────
  /** POST /campaigns/:id/ship-samples — JWT (own) */
  @Post('{id}/ship-samples')
  @Security('jwt')
  public async shipSamples(
    @Path() id: string,
    @Request() req: ExpressRequest
  ): Promise<CampaignDetailDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.shipSamples(user.userId, id);
  }

  // ─── POST /campaigns/:id/updates ──────────────────────────────────────────
  /** POST /campaigns/:id/updates — JWT (own) */
  @Post('{id}/updates')
  @Security('jwt')
  public async addUpdate(
    @Path() id: string,
    @Body() body: AddCampaignUpdateDto,
    @Request() req: ExpressRequest
  ): Promise<CampaignUpdateDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.addUpdate(user.userId, id, body);
  }

  // ─── GET /campaigns/:id/updates ───────────────────────────────────────────
  /** GET /campaigns/:id/updates — public */
  @Get('{id}/updates')
  public async getUpdates(
    @Path() id: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<CampaignUpdateDto>> {
    return this.campaignService.getUpdates(id, page, limit);
  }

  // ─── GET /campaigns/:id/coas ──────────────────────────────────────────────
  /** GET /campaigns/:id/coas — public */
  @Get('{id}/coas')
  public async getCoas(@Path() id: string): Promise<CoaDto[]> {
    return this.campaignService.getCoas(id);
  }

  // ─── GET /campaigns/:id/contributions ────────────────────────────────────
  /** GET /campaigns/:id/contributions — JWT */
  @Get('{id}/contributions')
  @Security('jwt')
  public async getContributions(
    @Path() id: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<ContributionDto>> {
    return this.campaignService.getContributions(id, page, limit);
  }

  // ─── GET /campaigns/:id/reactions ────────────────────────────────────────
  /** GET /campaigns/:id/reactions — public */
  @Get('{id}/reactions')
  public async getReactions(@Path() id: string): Promise<ReactionCountsDto> {
    return this.campaignService.getReactions(id);
  }

  // ─── POST /campaigns/:id/reactions ───────────────────────────────────────
  /** POST /campaigns/:id/reactions — JWT */
  @Post('{id}/reactions')
  @Security('jwt')
  public async addReaction(
    @Path() id: string,
    @Body() body: AddReactionDto,
    @Request() req: ExpressRequest
  ): Promise<{ reaction_type: string; created_at: string }> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.campaignService.addReaction(user.userId, id, body);
  }

  // ─── DELETE /campaigns/:id/reactions/:type ────────────────────────────────
  /** DELETE /campaigns/:id/reactions/:type — JWT */
  @Delete('{id}/reactions/{type}')
  @Security('jwt')
  @SuccessResponse(204, 'No Content')
  public async removeReaction(
    @Path() id: string,
    @Path() type: string,
    @Request() req: ExpressRequest
  ): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    await this.campaignService.removeReaction(user.userId, id, type);
    this.setStatus(204);
  }

  // ─── POST /campaigns/:id/contribute ───────────────────────────────────────
  /** POST /campaigns/:id/contribute — JWT (contributor) */
  @Post('{id}/contribute')
  @Security('jwt')
  public async contribute(
    @Path() id: string,
    @Body() body: ContributeDto,
    @Request() req: ExpressRequest
  ): Promise<ContributionDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.contributionService.contribute(
      user.userId,
      id,
      body,
      user.emailVerified,
      user.isBanned
    );
  }

  // ─── POST /campaigns/:id/samples/:sampleId/coa ────────────────────────────
  /** POST /campaigns/:id/samples/:sampleId/coa — JWT (own), multipart/form-data */
  @Post('{id}/samples/{sampleId}/coa')
  @Security('jwt')
  public async uploadCoa(
    @Path() id: string,
    @Path() sampleId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest
  ): Promise<CoaDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.coaService.uploadCoa(user.userId, id, sampleId, file.buffer, file.originalname);
  }
}
