import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface ApiBookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  metadata: {
    status: 'pending' | 'processing' | 'ready' | 'failed';
    pageTitle: string | null;
    description: string | null;
    openGraph: {
      title: string | null;
      description: string | null;
      imageUrl: string | null;
    };
    resolvedUrl: string | null;
    fetchedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

const pendingMetadata = {
  status: 'pending',
  pageTitle: null,
  description: null,
  openGraph: { title: null, description: null, imageUrl: null },
  resolvedUrl: null,
  fetchedAt: null,
};

const CONCURRENT_REQUESTS = 100;

const statusCounts = (
  responses: Array<{ status: number }>,
): Record<number, number> => {
  const counts: Record<number, number> = {};
  for (const { status } of responses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
};

const responseIds = ({ body }: { body: unknown }): string[] =>
  (body as { data: ApiBookmark[] }).data.map(({ id }) => id);

describe('Bookmark Manager (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const missingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const seedBookmarks = (rows: Prisma.BookmarkCreateInput[]) =>
    Promise.all(
      rows.map((data) =>
        prisma.bookmark.create({
          data: { metadata: { create: {} }, ...data },
        }),
      ),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    prisma = app.get(PrismaService);
    // Concurrent supertest requests need a server that is already listening.
    await app.listen(0);
  });

  beforeEach(async () => {
    await prisma.bookmark.deleteMany();
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

  it('runs a query against the test database', async () => {
    // Prisma returns SQLite integers from raw queries as BigInt.
    await expect(prisma.$queryRaw`SELECT 1 AS one`).resolves.toEqual([
      { one: 1n },
    ]);
  });

  it('creates, reads, updates and physically deletes a bookmark', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/bookmarks')
      .send({
        title: '  NestJS docs  ',
        url: '  http://localhost:3000/docs  ',
        description: '  Framework documentation  ',
      })
      .expect(201);

    const created = createResponse.body as ApiBookmark;
    expect(created).toMatchObject({
      title: 'NestJS docs',
      url: 'http://localhost:3000/docs',
      description: 'Framework documentation',
      metadata: pendingMetadata,
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(new Date(created.updatedAt).toISOString()).toBe(created.updatedAt);

    await request(app.getHttpServer())
      .get(`/bookmarks/${created.id}`)
      .expect(200)
      .expect(created);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const updateResponse = await request(app.getHttpServer())
      .patch(`/bookmarks/${created.id}`)
      .send({
        title: '  NestJS docs  ',
        url: '  http://localhost:3000/docs  ',
        description: '   ',
      })
      .expect(200);

    const updated = updateResponse.body as ApiBookmark;
    expect(updated).toMatchObject({
      id: created.id,
      title: 'NestJS docs',
      url: 'http://localhost:3000/docs',
      description: null,
    });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );

    await request(app.getHttpServer())
      .delete(`/bookmarks/${created.id}`)
      .expect(204)
      .expect('');

    await request(app.getHttpServer())
      .get(`/bookmarks/${created.id}`)
      .expect(404);
    await expect(
      prisma.bookmark.count({ where: { id: created.id } }),
    ).resolves.toBe(0);
  });

  it('normalizes an empty description to null on create', async () => {
    const response = await request(app.getHttpServer())
      .post('/bookmarks')
      .send({
        title: 'Example',
        url: 'https://example.com',
        description: '  ',
      })
      .expect(201);

    expect((response.body as ApiBookmark).description).toBeNull();
  });

  it('rejects duplicate normalized URLs with 409', async () => {
    await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ title: 'First', url: 'https://example.com/page' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ title: 'Second', url: '  https://example.com/page  ' })
      .expect(409);
  });

  it('rejects changing a bookmark to another bookmark URL', async () => {
    const first = await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ title: 'First', url: 'https://example.com/first' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ title: 'Second', url: 'https://example.com/second' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bookmarks/${(first.body as ApiBookmark).id}`)
      .send({ url: 'https://example.com/second' })
      .expect(409);
  });

  it('answers concurrent creates of one URL with one 201 and the rest 409', async () => {
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, (_, index) =>
        request(app.getHttpServer())
          .post('/bookmarks')
          .send({ title: `Racer ${index}`, url: 'https://example.com/race' }),
      ),
    );

    expect(statusCounts(responses)).toEqual({
      201: 1,
      409: CONCURRENT_REQUESTS - 1,
    });
    await expect(prisma.bookmark.count()).resolves.toBe(1);
  });

  it('answers concurrent changes to one URL with one 200 and the rest 409', async () => {
    const rows = Array.from({ length: CONCURRENT_REQUESTS }, (_, index) => ({
      title: `Racer ${index}`,
      url: `https://example.com/start-${index}`,
    }));
    const bookmarks = await seedBookmarks(rows);

    const responses = await Promise.all(
      bookmarks.map(({ id }) =>
        request(app.getHttpServer())
          .patch(`/bookmarks/${id}`)
          .send({ url: 'https://example.com/race' }),
      ),
    );

    expect(statusCounts(responses)).toEqual({
      200: 1,
      409: CONCURRENT_REQUESTS - 1,
    });
  });

  it('clears fetched metadata and queues another job when the URL changes', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/bookmarks')
      .send({ title: 'Example', url: 'https://example.com/old' })
      .expect(201);
    const bookmark = createResponse.body as ApiBookmark;

    await prisma.bookmarkMetadata.update({
      where: { bookmarkId: bookmark.id },
      data: {
        status: 'ready',
        pageTitle: 'Old title',
        resolvedUrl: bookmark.url,
        fetchedAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/bookmarks/${bookmark.id}`)
      .send({ url: 'https://example.com/new' })
      .expect(200);

    expect((response.body as ApiBookmark).metadata).toEqual(pendingMetadata);
  });

  it.each([
    ['an empty title', { title: '  ', url: 'https://example.com' }],
    ['a non-HTTP URL', { title: 'Bad URL', url: 'ftp://example.com' }],
    [
      'an overlong title',
      { title: 'x'.repeat(201), url: 'https://example.com' },
    ],
    [
      'server-managed fields',
      {
        title: 'Injected',
        url: 'https://example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    [
      'an extra field',
      { title: 'Extra', url: 'https://example.com', favorite: true },
    ],
  ])('rejects %s', async (_caseName, body) => {
    await request(app.getHttpServer())
      .post('/bookmarks')
      .send(body)
      .expect(400);
  });

  it('rejects invalid IDs and an empty PATCH with 400', async () => {
    await request(app.getHttpServer()).get('/bookmarks/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .patch(`/bookmarks/${missingId}`)
      .send({})
      .expect(400);
  });

  it('returns 404 for missing bookmark operations', async () => {
    await request(app.getHttpServer())
      .get(`/bookmarks/${missingId}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/bookmarks/${missingId}`)
      .send({ title: 'Missing' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/bookmarks/${missingId}`)
      .expect(404);
  });

  it('paginates with defaults and stable newest-first ordering', async () => {
    const rows = [
      {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Old',
        url: 'https://example.com/old',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Same timestamp, lower id',
        url: 'https://example.com/lower',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Same timestamp, higher id',
        url: 'https://example.com/higher',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Newest',
        url: 'https://example.com/newest',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ];
    await seedBookmarks(rows);

    const defaultResponse = await request(app.getHttpServer())
      .get('/bookmarks')
      .expect(200);
    expect(defaultResponse.body).toMatchObject({
      meta: { page: 1, limit: 20, total: 4, totalPages: 1 },
    });

    const firstPage = await request(app.getHttpServer())
      .get('/bookmarks?page=1&limit=2')
      .expect(200);
    expect(responseIds(firstPage)).toEqual([rows[3].id, rows[2].id]);
    expect(firstPage.body).toMatchObject({
      meta: { page: 1, limit: 2, total: 4, totalPages: 2 },
    });

    const secondPage = await request(app.getHttpServer())
      .get('/bookmarks?page=2&limit=2')
      .expect(200);
    expect(responseIds(secondPage)).toEqual([rows[1].id, rows[0].id]);

    await request(app.getHttpServer())
      .get('/bookmarks?page=3&limit=2')
      .expect(200)
      .expect({
        data: [],
        meta: { page: 3, limit: 2, total: 4, totalPages: 2 },
      });
  });

  it('searches user fields with filtered pagination and stable ordering', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Description match',
        url: 'https://example.com/description',
        description: 'A practical Guide for APIs',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'URL match',
        url: 'https://example.com/nestjs-guide',
        description: null,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'NestJS Guide',
        url: 'https://example.com/title',
        description: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Metadata only',
        url: 'https://example.com/metadata',
        description: null,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        metadata: { create: { pageTitle: 'Fetched guide metadata' } },
      },
    ];
    await seedBookmarks(rows);

    const firstPage = await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: '  GUIDE  ', page: 1, limit: 2 })
      .expect(200);
    expect(responseIds(firstPage)).toEqual([rows[2].id, rows[1].id]);
    expect(firstPage.body).toMatchObject({
      meta: { page: 1, limit: 2, total: 3, totalPages: 2 },
    });

    const secondPage = await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: 'guide', page: 2, limit: 2 })
      .expect(200);
    expect(responseIds(secondPage)).toEqual([rows[0].id]);

    await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: 'guide', page: 3, limit: 2 })
      .expect(200)
      .expect({
        data: [],
        meta: { page: 3, limit: 2, total: 3, totalPages: 2 },
      });
  });

  it('treats special search characters as literal text', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: '100% coverage',
        url: 'https://example.com/percent',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: '100X coverage',
        url: 'https://example.com/percent-decoy',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Underscore',
        url: 'https://example.com/underscore',
        description: 'snake_case',
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Underscore decoy',
        url: 'https://example.com/underscore-decoy',
        description: 'snakeXcase',
      },
    ];
    await seedBookmarks(rows);

    const percentResponse = await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: '%' })
      .expect(200);
    expect(responseIds(percentResponse)).toEqual([rows[0].id]);

    const underscoreResponse = await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: '_' })
      .expect(200);
    expect(responseIds(underscoreResponse)).toEqual([rows[2].id]);

    await request(app.getHttpServer())
      .get('/bookmarks')
      .query({ search: "' OR 1=1 --" })
      .expect(200)
      .expect({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
  });

  it.each([
    '/bookmarks?page=0',
    '/bookmarks?page=1.5',
    '/bookmarks?page=abc',
    '/bookmarks?limit=0',
    '/bookmarks?limit=101',
    '/bookmarks?search=%20%20%20',
    `/bookmarks?search=${'x'.repeat(201)}`,
  ])('rejects invalid list query: %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(400);
  });
});
