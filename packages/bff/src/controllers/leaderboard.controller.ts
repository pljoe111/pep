/**
 * LeaderboardController — spec §9.11
 */
import { inject } from 'tsyringe';
import { Controller, Get, Route, Tags, Query } from 'tsoa';
import { LeaderboardService } from '../services/leaderboard.service';
import type { LeaderboardEntryDto } from 'common';

@Route('leaderboard')
@Tags('Leaderboard')
export class LeaderboardController extends Controller {
  constructor(@inject(LeaderboardService) private readonly leaderboardService: LeaderboardService) {
    super();
  }

  /** GET /leaderboard/contributors */
  @Get('contributors')
  public async getContributors(
    @Query() period?: 'all' | 'monthly',
    @Query() limit?: number
  ): Promise<LeaderboardEntryDto[]> {
    return this.leaderboardService.getContributors(period, limit);
  }

  /** GET /leaderboard/creators */
  @Get('creators')
  public async getCreators(
    @Query() period?: 'all' | 'monthly',
    @Query() limit?: number
  ): Promise<LeaderboardEntryDto[]> {
    return this.leaderboardService.getCreators(period, limit);
  }
}
