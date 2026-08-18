import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok when the database answers', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        database: 'up',
      });
    });

    it('fails with 503 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('no such table'));

      expect.assertions(3);
      try {
        await appController.getHealth();
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const exception = error as ServiceUnavailableException;
        expect(exception.getStatus()).toBe(503);
        expect(exception.getResponse()).toEqual({
          status: 'degraded',
          database: 'down',
        });
      }
    });
  });
});
