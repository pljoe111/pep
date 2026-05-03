/**
 * PeptideController — normalized peptide catalog endpoints.
 * Public: GET /peptides (active only, for wizard cache)
 * Admin:  full CRUD + approve/reject
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
import { PeptideService } from '../services/peptide.service';
import type { PeptideDto, PeptideSummaryDto, CreatePeptideDto, UpdatePeptideDto } from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('peptides')
@Tags('Peptides')
export class PeptideController extends Controller {
  constructor(@inject(PeptideService) private readonly peptideService: PeptideService) {
    super();
  }

  /**
   * GET /peptides
   * Returns all active peptides. Used by the wizard for in-memory fuzzy search.
   */
  @Get('/')
  @OperationId('GetActivePeptides')
  public async getActive(): Promise<PeptideSummaryDto[]> {
    return this.peptideService.listActive();
  }

  /**
   * GET /peptides/all — admin or moderator (user_submitted_data_approver)
   * Returns all peptides including unreviewed (is_active=false).
   */
  @Get('/all')
  @Security('jwt', ['admin', 'user_submitted_data_approver'])
  @OperationId('GetAllPeptides')
  public async getAll(@Query() show_unreviewed?: boolean): Promise<PeptideDto[]> {
    return this.peptideService.listAll(show_unreviewed === true);
  }

  /**
   * POST /peptides/submit
   * User submits a new peptide for review (is_active=false).
   * Campaign wizard proceeds immediately; public pages show "⚠ Unreviewed Peptide".
   */
  @Post('/submit')
  @Security('jwt')
  @OperationId('SubmitPeptide')
  public async submit(
    @Body() body: CreatePeptideDto,
    @Request() req: AuthRequest
  ): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.submit(body, req.user.userId);
  }

  /**
   * POST /peptides — admin direct create (auto-approved)
   */
  @Post('/')
  @Security('jwt')
  @OperationId('CreatePeptide')
  public async create(
    @Body() body: CreatePeptideDto,
    @Request() req: AuthRequest
  ): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.create(body, req.user.userId);
  }

  /**
   * PATCH /peptides/:id
   */
  @Patch('{id}')
  @Security('jwt')
  @OperationId('UpdatePeptide')
  public async update(
    @Path() id: string,
    @Body() body: UpdatePeptideDto,
    @Request() req: AuthRequest
  ): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.update(id, body, req.user.userId);
  }

  /**
   * POST /peptides/:id/approve — admin or moderator (user_submitted_data_approver)
   */
  @Post('{id}/approve')
  @Security('jwt', ['admin', 'user_submitted_data_approver'])
  @OperationId('ApprovePeptide')
  public async approve(@Path() id: string, @Request() req: AuthRequest): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.approve(id, req.user.userId);
  }

  /**
   * POST /peptides/:id/reject — admin or moderator (user_submitted_data_approver)
   */
  @Post('{id}/reject')
  @Security('jwt', ['admin', 'user_submitted_data_approver'])
  @OperationId('RejectPeptide')
  public async reject(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.reject(id, req.user.userId);
  }

  /**
   * POST /peptides/:id/disable — admin
   */
  @Post('{id}/disable')
  @Security('jwt')
  @OperationId('DisablePeptide')
  public async disable(@Path() id: string, @Request() req: AuthRequest): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.disable(id, req.user.userId);
  }

  /**
   * POST /peptides/:id/enable — admin
   */
  @Post('{id}/enable')
  @Security('jwt')
  @OperationId('EnablePeptide')
  public async enable(@Path() id: string, @Request() req: AuthRequest): Promise<PeptideDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.enable(id, req.user.userId);
  }

  /**
   * DELETE /peptides/:id — admin, blocked if FK'd to samples
   */
  @Delete('{id}')
  @Security('jwt')
  @OperationId('DeletePeptide')
  public async delete(@Path() id: string, @Request() req: AuthRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    return this.peptideService.delete(id, req.user.userId);
  }
}
