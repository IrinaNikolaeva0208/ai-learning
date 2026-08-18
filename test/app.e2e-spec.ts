import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) reports a live database', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('/health (GET) answers 503 when the database is unreachable', async () => {
    const failing = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('database is gone'));

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({ status: 'degraded', database: 'down' });

    failing.mockRestore();
  });

  // There are no models yet, so this only proves the connection is real.
  // Replace with model-level assertions once the domain lands.
  it('runs a query against the test database', async () => {
    // Prisma returns SQLite integers from raw queries as BigInt.
    await expect(prisma.$queryRaw`SELECT 1 AS one`).resolves.toEqual([
      { one: 1n },
    ]);
  });
});
