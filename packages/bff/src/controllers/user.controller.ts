/**
 * UserController — spec §9.7
 */
import { inject } from 'tsyringe';
import { Controller, Get, Patch, Route, Tags, Body, Request, Security, Path } from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { UserService } from '../services/user.service';
import type {
  UserDto,
  PublicUserProfileDto,
  UpdateUserDto,
  NotificationPreferencesDto,
} from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';

@Route('users')
@Tags('Users')
export class UserController extends Controller {
  constructor(@inject(UserService) private readonly userService: UserService) {
    super();
  }

  /** GET /users/me — spec §9.7 */
  @Get('me')
  @Security('jwt')
  public async getMe(@Request() req: ExpressRequest): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.userService.getUser(user.userId);
  }

  /** PATCH /users/me — spec §9.7 */
  @Patch('me')
  @Security('jwt')
  public async updateMe(
    @Body() body: UpdateUserDto,
    @Request() req: ExpressRequest
  ): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.userService.updateUsername(user.userId, body, req.ip ?? undefined);
  }

  /** PATCH /users/me/notification-preferences — spec §9.7 */
  @Patch('me/notification-preferences')
  @Security('jwt')
  public async updateNotificationPreferences(
    @Body() body: NotificationPreferencesDto,
    @Request() req: ExpressRequest
  ): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.userService.updateNotificationPreferences(user.userId, body, req.ip ?? undefined);
  }

  /** GET /users/:id/profile — spec §9.7 (public) */
  @Get('{id}/profile')
  public async getPublicProfile(@Path() id: string): Promise<PublicUserProfileDto> {
    return this.userService.getPublicProfile(id);
  }
}
