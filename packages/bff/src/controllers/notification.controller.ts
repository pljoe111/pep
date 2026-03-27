/**
 * NotificationController — spec §9.8
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Get,
  Patch,
  Route,
  Tags,
  Request,
  Security,
  Path,
  Query,
  OperationId,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { NotificationService } from '../services/notification.service';
import type {
  NotificationDto,
  UnreadCountDto,
  MarkAllReadResponseDto,
  PaginatedResponseDto,
} from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';

@Route('notifications')
@Tags('Notifications')
@Security('jwt')
export class NotificationController extends Controller {
  constructor(@inject(NotificationService) private readonly notifService: NotificationService) {
    super();
  }

  /** GET /notifications */
  @Get('/')
  @OperationId('GetAllNotifications')
  public async getAll(
    @Request() req: ExpressRequest,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.notifService.getAll(user.userId, page, limit);
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  public async getUnreadCount(@Request() req: ExpressRequest): Promise<UnreadCountDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.notifService.getUnreadCount(user.userId);
  }

  /** PATCH /notifications/:id/read */
  @Patch('{id}/read')
  public async markRead(
    @Path() id: string,
    @Request() req: ExpressRequest
  ): Promise<NotificationDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.notifService.markRead(user.userId, id);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  public async markAllRead(@Request() req: ExpressRequest): Promise<MarkAllReadResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.notifService.markAllRead(user.userId);
  }
}
