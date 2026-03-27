/**
 * WalletController — spec §9.2
 */
import { inject } from 'tsyringe';
import { Controller, Get, Post, Route, Tags, Body, Request, Security, Query } from 'tsoa';
import { WalletService } from '../services/wallet.service';
import type {
  WalletBalanceDto,
  DepositAddressDto,
  WithdrawDto,
  WithdrawResponseDto,
  LedgerTransactionDto,
  PaginatedResponseDto,
} from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

@Route('wallet')
@Tags('Wallet')
@Security('jwt')
export class WalletController extends Controller {
  constructor(@inject(WalletService) private readonly walletService: WalletService) {
    super();
  }

  /** GET /wallet/balance */
  @Get('balance')
  public async getBalance(@Request() req: AuthRequest): Promise<WalletBalanceDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.walletService.getBalance(user.userId);
  }

  /** GET /wallet/deposit-address */
  @Get('deposit-address')
  public async getDepositAddress(@Request() req: AuthRequest): Promise<DepositAddressDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.walletService.getDepositAddress(user.userId);
  }

  /** POST /wallet/withdraw */
  @Post('withdraw')
  public async withdraw(
    @Body() body: WithdrawDto,
    @Request() req: AuthRequest
  ): Promise<WithdrawResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.walletService.requestWithdrawal(
      user.userId,
      body,
      user.emailVerified,
      user.isBanned,
      req.ip ?? undefined
    );
  }

  /** GET /wallet/transactions */
  @Get('transactions')
  public async getTransactions(
    @Request() req: AuthRequest,
    @Query() page?: number,
    @Query() limit?: number,
    @Query() type?: string
  ): Promise<PaginatedResponseDto<LedgerTransactionDto>> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;
    return this.walletService.getTransactions(user.userId, page, limit, type);
  }
}
