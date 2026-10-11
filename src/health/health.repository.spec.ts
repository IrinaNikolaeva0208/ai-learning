import { PrismaService } from '../prisma/prisma.service';
import { HealthRepository } from './health.repository';

describe('HealthRepository', () => {
  it('checks the database with a raw query', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1n }]) };
    const repository = new HealthRepository(prisma as unknown as PrismaService);

    await expect(repository.checkDatabase()).resolves.toBeUndefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
