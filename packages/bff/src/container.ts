import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaService } from './services/prisma.service';

container.registerSingleton(PrismaService);

export { container };
