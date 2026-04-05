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
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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

  // ── Master wallet singleton ───────────────────────────────────────────────
  const existingMasterWallet = await prisma.masterWallet.findFirst();
  if (!existingMasterWallet) {
    await prisma.masterWallet.create({ data: {} });
    console.log('✔ master_wallet created');
  } else {
    console.log('  master_wallet already exists — skipped');
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
        min_creator_balance_usd: 1.0,
      },
      description:
        'Platform-wide minimums for contributions, funding thresholds, withdrawals, and campaign creation (USD).',
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
    {
      key: 'default_sweep_wallet',
      value: { address: '' },
      description: 'Default Solana wallet address for fee sweeps.',
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

  // ── Admin Account ──────────────────────────────────────────────────────────
  // Create or upsert an admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('base64');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: adminPasswordHash,
        email_verified: true,
        username: 'admin',
      },
    });
    console.log(`✔ admin user created: email=${adminEmail} password=${adminPassword}`);
  } else {
    console.log('  admin user already exists — skipped');
  }
  // Grant admin claim
  await prisma.userClaim.upsert({
    where: { user_id_claim_type: { user_id: adminUser.id, claim_type: 'admin' } },
    update: {},
    create: {
      user_id: adminUser.id,
      claim_type: 'admin',
      granted_by_user_id: adminUser.id,
    },
  });
  console.log('✔ admin claim granted');

  // ── BT Labs ─────────────────────────────────────────────────────────────────
  // A real system UUID used as the seed "actor" for audit columns that require a
  // user ID but have no FK constraint. Never corresponds to a real user row.
  const SEED_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
  const seedNow = new Date();

  const btLab = await prisma.lab.upsert({
    where: { name: 'BT Labs' },
    update: { is_approved: true, approved_by_user_id: SEED_ACTOR_ID, approved_at: seedNow },
    create: {
      name: 'BT Labs',
      country: 'United States',
      is_approved: true,
      approved_by_user_id: SEED_ACTOR_ID,
      approved_at: seedNow,
    },
  });
  console.log(`✔ lab["BT Labs"] upserted (${btLab.id})`);

  // ID/P/P — Identity, Purity, Potency
  const idppTest = await prisma.test.upsert({
    where: { name: 'ID/P/P' },
    update: {},
    create: {
      name: 'ID/P/P',
      description:
        'Identity, Purity, and Potency testing for peptide samples. Requires 1 vial per sample.',
      is_active: true,
      created_by_user_id: SEED_ACTOR_ID,
    },
  });
  console.log(`✔ test["ID/P/P"] upserted (${idppTest.id})`);

  // Endotoxins — USP <85> LAL method
  const endotoxinsTest = await prisma.test.upsert({
    where: { name: 'Endotoxins' },
    update: {},
    create: {
      name: 'Endotoxins',
      description: 'Bacterial endotoxin testing (USP <85> LAL method). Requires 1 vial per sample.',
      usp_code: 'USP<85>',
      is_active: true,
      created_by_user_id: SEED_ACTOR_ID,
    },
  });
  console.log(`✔ test["Endotoxins"] upserted (${endotoxinsTest.id})`);

  // ── Claim Templates for ID/P/P ───────────────────────────────────────────
  // identity claim (required — locked to peptide name in wizard)
  await prisma.testClaimTemplate.upsert({
    where: { test_id_claim_kind: { test_id: idppTest.id, claim_kind: 'identity' } },
    update: {},
    create: {
      test_id: idppTest.id,
      claim_kind: 'identity',
      label: 'Peptide Identity (MS confirmed)',
      is_required: true,
      sort_order: 0,
    },
  });
  // purity claim (required)
  await prisma.testClaimTemplate.upsert({
    where: { test_id_claim_kind: { test_id: idppTest.id, claim_kind: 'purity' } },
    update: {},
    create: {
      test_id: idppTest.id,
      claim_kind: 'purity',
      label: 'Purity by HPLC (%)',
      is_required: true,
      sort_order: 1,
    },
  });
  // mass claim (required)
  await prisma.testClaimTemplate.upsert({
    where: { test_id_claim_kind: { test_id: idppTest.id, claim_kind: 'mass' } },
    update: {},
    create: {
      test_id: idppTest.id,
      claim_kind: 'mass',
      label: 'Mass Amount (mg)',
      is_required: true,
      sort_order: 2,
    },
  });
  console.log('✔ claim_templates[ID/P/P] upserted');

  // ── Claim Templates for Endotoxins ───────────────────────────────────────
  await prisma.testClaimTemplate.upsert({
    where: { test_id_claim_kind: { test_id: endotoxinsTest.id, claim_kind: 'endotoxins' } },
    update: {},
    create: {
      test_id: endotoxinsTest.id,
      claim_kind: 'endotoxins',
      label: 'Endotoxin Level (EU/mg)',
      is_required: true,
      sort_order: 0,
    },
  });
  console.log('✔ claim_templates[Endotoxins] upserted');

  await prisma.labTest.upsert({
    where: { lab_id_test_id: { lab_id: btLab.id, test_id: idppTest.id } },
    update: { price_usd: 125, typical_turnaround_days: 14 },
    create: {
      lab_id: btLab.id,
      test_id: idppTest.id,
      price_usd: 125,
      typical_turnaround_days: 14,
    },
  });
  console.log('✔ lab_test[BT Labs × ID/P/P] = $125 upserted');

  await prisma.labTest.upsert({
    where: { lab_id_test_id: { lab_id: btLab.id, test_id: endotoxinsTest.id } },
    update: { price_usd: 250, typical_turnaround_days: 14 },
    create: {
      lab_id: btLab.id,
      test_id: endotoxinsTest.id,
      price_usd: 250,
      typical_turnaround_days: 14,
    },
  });
  console.log('✔ lab_test[BT Labs × Endotoxins] = $250 upserted');
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
