export interface LeaderboardEntryDto {
  rank: number;
  user: {
    id: string;
    username: string | null;
  };
  /** total_usd for contributors; resolved_count for creators */
  value: number;
  period: 'all' | 'monthly';
}
