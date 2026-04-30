import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { injectable } from 'tsyringe';
import { env } from '../config/env.config';

@injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const requireSsl = !env.DATABASE_URL.includes('localhost');
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ...(requireSsl && { ssl: { rejectUnauthorized: false } }),
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    void this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }
}
