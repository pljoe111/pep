import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';

@injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super();
    void this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }
}
