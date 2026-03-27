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
import { NotificationService } from '../services/notification.service';
import type {
  NotificationDto,
  UnreadCountDto,
  MarkAllReadResponseDto,
  PaginatedResponseDto,
} from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

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
    @Request() req: AuthRequest,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<PaginatedResponseDto<NotificationDto>> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.notifService.getAll(user.userId, page, limit);
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  public async getUnreadCount(@Request() req: AuthRequest): Promise<UnreadCountDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.notifService.getUnreadCount(user.userId);
  }

  /** PATCH /notifications/:id/read */
  @Patch('{id}/read')
  public async markRead(@Path() id: string, @Request() req: AuthRequest): Promise<NotificationDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.notifService.markRead(user.userId, id);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  public async markAllRead(@Request() req: AuthRequest): Promise<MarkAllReadResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.notifService.markAllRead(user.userId);
  }
}
