/**
 * AuthController — spec §9.1
 * All dependencies injected via tsyringe; tsoa handles routing.
 * Per coding rules §4.2: controllers never call res.status() directly.
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Post,
  Route,
  Tags,
  Body,
  Request,
  Response,
  SuccessResponse,
  Security,
  Get,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from '../services/auth.service';
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  RegisterResponseDto,
  AuthResponseDto,
  RefreshResponseDto,
  VerifyEmailDto,
  MessageResponseDto,
  UserDto,
} from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  constructor(@inject(AuthService) private readonly authService: AuthService) {
    super();
  }

  /** POST /auth/register — spec §9.1 */
  @Post('register')
  @SuccessResponse(201, 'Created')
  @Response(400, 'Validation error')
  public async register(
    @Body() body: RegisterDto,
    @Request() req: ExpressRequest
  ): Promise<RegisterResponseDto> {
    this.setStatus(201);
    return this.authService.register(body, req.ip ?? undefined);
  }

  /** POST /auth/login — spec §9.1 */
  @Post('login')
  public async login(
    @Body() body: LoginDto,
    @Request() req: ExpressRequest
  ): Promise<AuthResponseDto> {
    return this.authService.login(body, req.ip ?? undefined);
  }

  /** POST /auth/refresh — spec §9.1 */
  @Post('refresh')
  public async refresh(
    @Body() body: RefreshTokenDto,
    @Request() req: ExpressRequest
  ): Promise<RefreshResponseDto> {
    return this.authService.refreshToken(body.refreshToken, req.ip ?? undefined);
  }

  /** POST /auth/logout — spec §9.1 — deletes all active refresh tokens */
  @Post('logout')
  @Security('jwt')
  @SuccessResponse(204, 'No Content')
  public async logout(@Request() req: ExpressRequest): Promise<void> {
    // SAFETY: expressAuthentication guarantees req.user is JwtPayload on @Security routes.
    const user = req.user as JwtPayload;
    await this.authService.logout(user.userId);
    this.setStatus(204);
  }

  /** GET /auth/me — spec §9.1 */
  @Get('me')
  @Security('jwt')
  public async me(@Request() req: ExpressRequest): Promise<UserDto> {
    // SAFETY: expressAuthentication guarantees req.user is JwtPayload on @Security routes.
    const user = req.user as JwtPayload;
    return this.authService.buildUserDto(user.userId);
  }

  /** POST /auth/verify-email — spec §9.1 */
  @Post('verify-email')
  public async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Request() req: ExpressRequest
  ): Promise<MessageResponseDto> {
    await this.authService.verifyEmail(body.token, req.ip ?? undefined);
    return { message: 'Email verified successfully' };
  }

  /** POST /auth/resend-verification — spec §9.1 (JWT required) */
  @Post('resend-verification')
  @Security('jwt')
  public async resendVerification(@Request() req: ExpressRequest): Promise<MessageResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user is JwtPayload on @Security routes.
    const user = req.user as JwtPayload;
    await this.authService.resendVerification(user.userId);
    return { message: 'Verification email sent' };
  }
}
