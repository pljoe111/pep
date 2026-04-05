/**
 * VendorController — normalized vendor registry endpoints.
 * Public:  GET /vendors/search?q= (debounced from wizard combobox)
 * User:    POST /vendors/submit
 * Admin:   full CRUD + review (approve/reject/suspend/reinstate)
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
import { VendorService } from '../services/vendor.service';
import type {
  VendorDto,
  VendorSummaryDto,
  CreateVendorDto,
  UpdateVendorDto,
  ReviewVendorDto,
} from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('vendors')
@Tags('Vendors')
export class VendorController extends Controller {
  constructor(@inject(VendorService) private readonly vendorService: VendorService) {
    super();
  }

  /**
   * GET /vendors/search?q=
   * Debounced vendor name search for wizard combobox.
   * Returns non-rejected vendors only.
   */
  @Get('/search')
  @OperationId('SearchVendors')
  public async search(@Query() q: string, @Query() limit?: number): Promise<VendorSummaryDto[]> {
    return this.vendorService.search(q, limit);
  }

  /**
   * GET /vendors — admin only
   * Full list with optional status filter.
   */
  @Get('/')
  @Security('jwt')
  @OperationId('GetAllVendors')
  public async getAll(@Query() status?: 'pending' | 'approved' | 'rejected'): Promise<VendorDto[]> {
    return this.vendorService.listAll(status);
  }

  /**
   * GET /vendors/:id — admin
   */
  @Get('{id}')
  @Security('jwt')
  @OperationId('GetVendorById')
  public async getById(@Path() id: string): Promise<VendorDto> {
    return this.vendorService.findById(id);
  }

  /**
   * POST /vendors/submit
   * User submits a new vendor for review (status=pending).
   * Campaign wizard proceeds immediately; public pages show "⚠ Unverified".
   */
  @Post('/submit')
  @Security('jwt')
  @OperationId('SubmitVendor')
  public async submit(
    @Body() body: CreateVendorDto,
    @Request() req: AuthRequest
  ): Promise<VendorDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.submit(body, req.user.userId);
  }

  /**
   * POST /vendors — admin direct create (auto-approved)
   */
  @Post('/')
  @Security('jwt')
  @OperationId('CreateVendor')
  public async create(
    @Body() body: CreateVendorDto,
    @Request() req: AuthRequest
  ): Promise<VendorDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.create(body, req.user.userId);
  }

  /**
   * PATCH /vendors/:id — admin
   */
  @Patch('{id}')
  @Security('jwt')
  @OperationId('UpdateVendor')
  public async update(
    @Path() id: string,
    @Body() body: UpdateVendorDto,
    @Request() req: AuthRequest
  ): Promise<VendorDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.update(id, body, req.user.userId);
  }

  /**
   * POST /vendors/:id/review — admin approve or reject
   */
  @Post('{id}/review')
  @Security('jwt')
  @OperationId('ReviewVendor')
  public async review(
    @Path() id: string,
    @Body() body: ReviewVendorDto,
    @Request() req: AuthRequest
  ): Promise<VendorDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.review(id, body, req.user.userId);
  }

  /**
   * POST /vendors/:id/reinstate — admin (set approved)
   */
  @Post('{id}/reinstate')
  @Security('jwt')
  @OperationId('ReinstateVendor')
  public async reinstate(@Path() id: string, @Request() req: AuthRequest): Promise<VendorDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.reinstate(id, req.user.userId);
  }

  /**
   * GET /vendors/:id/campaign-count — admin, returns count for suspension warning
   */
  @Get('{id}/campaign-count')
  @Security('jwt')
  @OperationId('GetVendorActiveCampaignCount')
  public async getActiveCampaignCount(@Path() id: string): Promise<{ count: number }> {
    const count = await this.vendorService.countActiveCampaigns(id);
    return { count };
  }

  /**
   * DELETE /vendors/:id — admin, blocked if samples attached
   */
  @Delete('{id}')
  @Security('jwt')
  @OperationId('DeleteVendor')
  public async delete(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.vendorService.delete(id, req.user.userId);
  }
}
