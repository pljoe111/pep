/**
 * AuthService — implements spec §7.1 (register), §7.2 (login),
 * §7.3 (refresh), §7.16 (email verification), and logout.
 *
 * All DB operations that write tokens are wrapped in a single
 * DB transaction. Email enqueue happens outside the transaction.
 */
import { injectable, inject } from 'tsyringe';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { Keypair } from '@solana/web3.js';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { encryptString, randomHex } from '../utils/crypto.util';
import { emailQueue, type EmailJobPayload } from '../utils/queue.util';
import { env } from '../config/env.config';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import type {
  RegisterDto,
  LoginDto,
  RegisterResponseDto,
  AuthResponseDto,
  RefreshResponseDto,
  UserDto,
} from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';

const logger = pino({ name: 'AuthService' });
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  // SAFETY: JWT_SECRET is validated at startup through env.config.ts.
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return d;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@injectable()
export class AuthService {
  constructor(
    @inject(PrismaService) private readonly prisma: PrismaService,
    @inject(AuditService) private readonly audit: AuditService
  ) {}

  // ─── 7.1 Register ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto, ipAddress?: string): Promise<RegisterResponseDto> {
    // Pre-check uniqueness (DB unique constraint also guards, but give a nicer error)
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, ...(dto.username ? [{ username: dto.username }] : [])],
      },
    });
    if (existing !== null) {
      if (existing.email === dto.email) {
        throw new ValidationError('Email already in use');
      }
      throw new ValidationError('Username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Generate deposit keypair and encrypt private key
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    // Only solana.service.ts and withdrawal.worker.ts may access MASTER_WALLET_PRIVATE_KEY.
    // Here we encrypt the DEPOSIT ADDRESS private key (not the master key).
    const encryptedPrivateKey = encryptString(Buffer.from(keypair.secretKey).toString('hex'));

    // Generate email verification token
    const rawVerificationToken = randomHex(32); // 64 hex chars
    const verificationTokenHash = sha256Hex(rawVerificationToken);
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    // Generate refresh token
    const rawRefreshToken = randomHex(32);
    const refreshTokenHash = sha256Hex(rawRefreshToken);
    const refreshTokenExpiry = refreshTokenExpiresAt();

    let userId = '';
    let depositAddressPublicKey = '';

    await this.prisma.$transaction(
      async (tx) => {
        // 2. Create User
        const user = await tx.user.create({
          data: {
            email: dto.email,
            password_hash: passwordHash,
            ...(dto.username !== undefined ? { username: dto.username } : {}),
            email_verified: false,
            notification_preferences: {
              campaign_funded: { email: true, in_app: true },
              campaign_locked: { email: true, in_app: true },
              samples_shipped: { email: false, in_app: true },
              coa_uploaded: { email: true, in_app: true },
              campaign_refunded: { email: true, in_app: true },
              campaign_resolved: { email: true, in_app: true },
              deposit_confirmed: { email: false, in_app: true },
              withdrawal_sent: { email: true, in_app: true },
              withdrawal_failed: { email: true, in_app: true },
            },
          },
        });
        userId = user.id;

        // 3. Create LedgerAccount (balances = 0)
        await tx.ledgerAccount.create({
          data: { user_id: userId },
        });

        // 4 & 5. Create DepositAddress with encrypted keypair
        const depAddr = await tx.depositAddress.create({
          data: {
            user_id: userId,
            public_key: publicKey,
            encrypted_private_key: encryptedPrivateKey,
          },
        });
        depositAddressPublicKey = depAddr.public_key;

        // 6. Grant default claims
        await tx.userClaim.createMany({
          data: [
            { user_id: userId, claim_type: 'campaign_creator' },
            { user_id: userId, claim_type: 'contributor' },
          ],
        });

        // 7. Email verification token
        await tx.emailVerificationToken.create({
          data: {
            user_id: userId,
            token_hash: verificationTokenHash,
            expires_at: verificationTokenExpiry,
          },
        });

        // 9. Refresh token row
        await tx.refreshToken.create({
          data: {
            user_id: userId,
            token_hash: refreshTokenHash,
            expires_at: refreshTokenExpiry,
            ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // 10. Enqueue email job (outside transaction)
    const emailPayload: EmailJobPayload = {
      to: dto.email,
      subject: 'Verify your email address',
      html: `<p>Click to verify: ${env.FRONTEND_URL}/verify-email?token=${rawVerificationToken}</p>`,
      text: `Verify your email: ${env.FRONTEND_URL}/verify-email?token=${rawVerificationToken}`,
    };
    await emailQueue.add(emailPayload);

    // 8. Generate JWT access token
    const userDto = await this.buildUserDto(userId);
    const accessToken = signAccessToken({
      userId,
      email: dto.email,
      emailVerified: false,
      claims: userDto.claims,
      isBanned: false,
    });

    this.audit.log({
      userId,
      action: 'user.registered',
      entityType: 'user',
      entityId: userId,
      ipAddress,
    });

    return {
      user: userDto,
      accessToken,
      refreshToken: rawRefreshToken,
      depositAddress: depositAddressPublicKey,
    };
  }

  // ─── 7.2 Login ─────────────────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponseDto> {
    // Use same error for not-found AND wrong-password (prevents email enumeration)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const invalidCred = new AuthenticationError('Invalid credentials');
    if (user === null) throw invalidCred;

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) throw invalidCred;

    if (user.is_banned) throw new AuthorizationError('Account suspended');

    const rawRefreshToken = randomHex(32);
    const refreshTokenHash = sha256Hex(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshTokenExpiresAt(),
        ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
      },
    });

    const userDto = await this.buildUserDto(user.id);
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      claims: userDto.claims,
      isBanned: false,
    });

    this.audit.log({
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    return { user: userDto, accessToken, refreshToken: rawRefreshToken };
  }

  // ─── 7.3 Refresh Token ─────────────────────────────────────────────────────

  async refreshToken(rawToken: string, ipAddress?: string): Promise<RefreshResponseDto> {
    const tokenHash = sha256Hex(rawToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
    });

    if (existing === null) throw new AuthenticationError('Invalid refresh token');

    // Replay attack detection
    if (existing.used_at !== null) {
      logger.warn(
        { userId: existing.user_id },
        'Refresh token replay detected — revoking all sessions'
      );
      await this.prisma.refreshToken.deleteMany({ where: { user_id: existing.user_id } });
      throw new AuthenticationError('Token reuse detected');
    }

    if (existing.expires_at < new Date()) {
      throw new AuthenticationError('Token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.user_id } });
    if (user === null) throw new AuthenticationError('User not found');
    if (user.is_banned) throw new AuthorizationError('Account suspended');

    // Mark old token used and issue new pair
    const rawNewToken = randomHex(32);
    const newTokenHash = sha256Hex(rawNewToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { used_at: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          user_id: user.id,
          token_hash: newTokenHash,
          expires_at: refreshTokenExpiresAt(),
          ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
        },
      });
    });

    const userDto = await this.buildUserDto(user.id);
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      claims: userDto.claims,
      isBanned: false,
    });

    return { accessToken, refreshToken: rawNewToken };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { user_id: userId } });
  }

  // ─── 7.16 Verify Email ─────────────────────────────────────────────────────

  async verifyEmail(rawToken: string, ipAddress?: string): Promise<AuthResponseDto> {
    const tokenHash = sha256Hex(rawToken);

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token_hash: tokenHash },
    });

    if (record === null || record.expires_at < new Date() || record.used_at !== null) {
      throw new ValidationError('Invalid or expired token');
    }

    const rawRefreshToken = randomHex(32);
    const refreshTokenHash = sha256Hex(rawRefreshToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.user_id }, data: { email_verified: true } });
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { used_at: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          user_id: record.user_id,
          token_hash: refreshTokenHash,
          expires_at: refreshTokenExpiresAt(),
          ...(ipAddress !== undefined ? { ip_address: ipAddress } : {}),
        },
      });
    });

    this.audit.log({
      userId: record.user_id,
      action: 'user.email_verified',
      entityType: 'user',
      entityId: record.user_id,
      ipAddress,
    });

    const userDto = await this.buildUserDto(record.user_id);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.user_id } });
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      emailVerified: true,
      claims: userDto.claims,
      isBanned: false,
    });

    return { user: userDto, accessToken, refreshToken: rawRefreshToken };
  }

  // ─── 7.16 Resend Verification ──────────────────────────────────────────────

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new ValidationError('User not found');
    if (user.email_verified) throw new ConflictError('Email already verified');

    // Invalidate existing unused tokens
    await this.prisma.emailVerificationToken.updateMany({
      where: { user_id: userId, used_at: undefined },
      data: { used_at: new Date() },
    });

    const rawToken = randomHex(32);
    const tokenHash = sha256Hex(rawToken);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { user_id: userId, token_hash: tokenHash, expires_at: expiry },
    });

    const emailPayload: EmailJobPayload = {
      to: user.email,
      subject: 'Verify your email address',
      html: `<p>Click to verify: ${env.FRONTEND_URL}/verify-email?token=${rawToken}</p>`,
      text: `Verify your email: ${env.FRONTEND_URL}/verify-email?token=${rawToken}`,
    };
    await emailQueue.add(emailPayload);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  async buildUserDto(userId: string): Promise<UserDto> {
    const [user, claims, contribStats, campaignStats] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.userClaim.findMany({ where: { user_id: userId } }),
      this.prisma.contribution.aggregate({
        where: { contributor_id: userId, status: 'completed' },
        _sum: { amount_usd: true },
      }),
      this.prisma.campaign.aggregate({
        where: { creator_id: userId },
        _count: { _all: true },
      }),
    ]);

    const resolvedCampaigns = await this.prisma.campaign.count({
      where: { creator_id: userId, status: 'resolved' },
    });
    const refundedCampaigns = await this.prisma.campaign.count({
      where: { creator_id: userId, status: 'refunded' },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      is_banned: user.is_banned,
      email_verified: user.email_verified,
      claims: claims.map((c) => c.claim_type as import('common').ClaimType),
      stats: {
        total_contributed_usd: Number(contribStats._sum.amount_usd ?? 0),
        campaigns_created: campaignStats._count._all,
        campaigns_successful: resolvedCampaigns,
        campaigns_refunded: refundedCampaigns,
      },
      created_at: user.created_at.toISOString(),
    };
  }
}
