/**
 * Prisma seed — run with: pnpm --filter bff exec prisma db seed
 *
 * Inserts:
 *   - fee_account singleton row
 *   - configuration rows (spec §4.23) with penny-friendly minimums for testing
 *
 * Safe to re-run: uses upsert so existing rows are updated in-place.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  // ── Fee account singleton ────────────────────────────────────────────────
  const existing = await prisma.feeAccount.findFirst();
  if (!existing) {
    await prisma.feeAccount.create({ data: {} });
    console.log('✔ fee_account created');
  } else {
    console.log('  fee_account already exists — skipped');
  }

  // ── Configuration rows ────────────────────────────────────────────────────
  type Row = { key: string; value: unknown; description: string };
  const rows: Row[] = [
    {
      key: 'valid_mass_units',
      value: { units: ['mg', 'g', 'kg', 'mcg', 'oz', 'lb', 'IU'] },
      description: 'Allowed units for mass-type sample claims.',
    },
    {
      key: 'global_minimums',
      value: {
        // Penny-minimums for real-money testing
        min_contribution_usd: 0.01,
        min_funding_threshold_usd: 0.01,
        min_funding_threshold_percent: 5,
        min_withdrawal_usd: 0.01,
      },
      description:
        'Platform-wide minimums for contributions, funding thresholds, and withdrawals (USD).',
    },
    {
      key: 'platform_fee_percent',
      value: { value: 5 },
      description: 'Platform fee taken from payout on campaign resolution (percent, 0-100).',
    },
    {
      key: 'max_campaign_multiplier',
      value: { value: 10 },
      description:
        'Max ratio of amount_requested_usd to estimated_lab_cost_usd a campaign may request.',
    },
    {
      key: 'auto_flag_threshold_usd',
      value: { value: 10000 },
      description: 'Campaigns requesting more than this amount (USD) are auto-flagged for review.',
    },
    {
      key: 'max_withdrawal_per_day',
      value: { value: 10 },
      description: 'Rolling 24-hour limit on withdrawal requests per user.',
    },
    {
      key: 'max_file_size_bytes',
      value: { value: 10_485_760 }, // 10 MB
      description: 'Maximum file size for COA uploads in bytes.',
    },
  ];

  for (const row of rows) {
    await prisma.configuration.upsert({
      where: { config_key: row.key },
      update: {
        config_value: row.value as Parameters<
          typeof prisma.configuration.update
        >[0]['data']['config_value'],
        description: row.description,
      },
      create: {
        config_key: row.key,
        config_value: row.value as Parameters<
          typeof prisma.configuration.create
        >[0]['data']['config_value'],
        description: row.description,
      },
    });
    console.log(`✔ configuration["${row.key}"] upserted`);
  }

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
    void pool.end();
  });
