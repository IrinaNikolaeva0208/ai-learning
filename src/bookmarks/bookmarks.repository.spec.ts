import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BookmarkStoreBusyError } from './bookmark-store-busy.error';
import { BookmarksRepository } from './bookmarks.repository';
import { DuplicateBookmarkUrlError } from './duplicate-bookmark-url.error';
import { Bookmark } from './types/bookmark.interface';

describe('BookmarksRepository', () => {
  const bookmark: Bookmark = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'NestJS',
    url: 'https://nestjs.com',
    description: null,
    metadata: {
      status: 'pending',
      pageTitle: null,
      description: null,
      openGraph: { title: null, description: null, imageUrl: null },
      resolvedUrl: null,
      fetchedAt: null,
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const bookmarkRecord = {
    ...bookmark,
    metadata: {
      bookmarkId: bookmark.id,
      status: 'pending',
      pageTitle: null,
      description: null,
      openGraphTitle: null,
      openGraphDescription: null,
      openGraphImageUrl: null,
      resolvedUrl: null,
      fetchedAt: null,
      attempts: 0,
      nextAttemptAt: bookmark.createdAt,
      lockToken: null,
      leaseExpiresAt: null,
      lastError: null,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    },
  };

  let bookmarkDelegate: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let transactionDelegate: typeof bookmarkDelegate;
  let queryRaw: jest.Mock;
  let prisma: { bookmark: typeof bookmarkDelegate; $transaction: jest.Mock };
  let repository: BookmarksRepository;

  const makeDelegate = (): typeof bookmarkDelegate => ({
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(() => {
    bookmarkDelegate = makeDelegate();
    transactionDelegate = makeDelegate();
    queryRaw = jest.fn();
    prisma = {
      bookmark: bookmarkDelegate,
      $transaction: jest.fn().mockImplementation((argument: unknown) => {
        if (typeof argument === 'function') {
          const callback = argument as (client: {
            bookmark: typeof transactionDelegate;
            $queryRaw: typeof queryRaw;
          }) => Promise<unknown>;
          return callback({
            bookmark: transactionDelegate,
            $queryRaw: queryRaw,
          });
        }

        return Promise.all(argument as Promise<unknown>[]);
      }),
    };
    repository = new BookmarksRepository(prisma as unknown as PrismaService);
  });

  it('uses the transaction client supplied to withTransaction', async () => {
    transactionDelegate.findUnique.mockResolvedValue(bookmarkRecord);

    await repository.withTransaction((transaction) =>
      transaction.findById(bookmark.id),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: bookmark.id },
      include: { metadata: true },
    });
    expect(bookmarkDelegate.findUnique).not.toHaveBeenCalled();
  });

  it('reuses the transaction client for a nested transaction', async () => {
    transactionDelegate.findUnique.mockResolvedValue(bookmarkRecord);

    await repository.withTransaction((transaction) =>
      transaction.withTransaction((nestedTransaction) =>
        nestedTransaction.findById(bookmark.id),
      ),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: bookmark.id },
      include: { metadata: true },
    });
  });

  it('creates with the provided data', async () => {
    bookmarkDelegate.create.mockResolvedValue(bookmarkRecord);
    const data = { title: bookmark.title, url: bookmark.url };

    await expect(repository.create(data)).resolves.toEqual(bookmarkRecord);
    expect(bookmarkDelegate.create).toHaveBeenCalledWith({
      data: { ...data, metadata: { create: {} } },
      include: { metadata: true },
    });
  });

  it('finds records by id', async () => {
    bookmarkDelegate.findUnique.mockResolvedValue(bookmarkRecord);

    await repository.findById(bookmark.id);

    expect(bookmarkDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: bookmark.id },
      include: { metadata: true },
    });
  });

  it('returns null for missing records', async () => {
    bookmarkDelegate.findUnique.mockResolvedValue(null);

    await expect(repository.findById(bookmark.id)).resolves.toBeNull();
  });

  it('counts and lists a page in one transaction with stable ordering', async () => {
    bookmarkDelegate.count.mockResolvedValue(3);
    bookmarkDelegate.findMany.mockResolvedValue([bookmarkRecord]);

    await expect(repository.findPage(2, 10)).resolves.toEqual({
      total: 3,
      data: [bookmarkRecord],
    });
    expect(bookmarkDelegate.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { metadata: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
    ]);
  });

  it('searches literal user-field text with bound values and pagination', async () => {
    const search = `%_' OR 1=1 --`;
    queryRaw
      .mockResolvedValueOnce([{ total: 1n }])
      .mockResolvedValueOnce([{ id: bookmark.id }]);
    transactionDelegate.findMany.mockResolvedValue([bookmarkRecord]);

    await expect(repository.findPage(2, 10, search)).resolves.toEqual({
      total: 1,
      data: [bookmarkRecord],
    });

    const queries = queryRaw.mock.calls as Array<[Prisma.Sql]>;
    const countQuery = queries[0][0];
    const pageQuery = queries[1][0];
    expect(countQuery.sql).toContain('instr(lower("title"), lower(?))');
    expect(countQuery.sql).toContain('instr(lower("url"), lower(?))');
    expect(countQuery.sql).toContain('instr(lower("description"), lower(?))');
    expect(countQuery.sql).not.toContain(search);
    expect(countQuery.values).toEqual([search, search, search]);
    expect(pageQuery.values).toEqual([search, search, search, 10, 10]);
    expect(transactionDelegate.findMany).toHaveBeenCalledWith({
      where: { id: { in: [bookmark.id] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { metadata: true },
    });
  });

  it('returns the filtered total without loading records for an empty page', async () => {
    queryRaw.mockResolvedValueOnce([{ total: 3n }]).mockResolvedValueOnce([]);

    await expect(repository.findPage(4, 10, 'missing')).resolves.toEqual({
      total: 3,
      data: [],
    });
    expect(transactionDelegate.findMany).not.toHaveBeenCalled();
  });

  describe.each([
    ['create', () => repository.create({ title: 't', url: bookmark.url })],
    ['update', () => repository.update(bookmark.id, { url: bookmark.url })],
  ] as const)('%s write errors', (method, write) => {
    it('translates a unique violation', async () => {
      bookmarkDelegate[method].mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(write()).rejects.toBeInstanceOf(DuplicateBookmarkUrlError);
    });

    it('translates a lock timeout', async () => {
      bookmarkDelegate[method].mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Operation timed out', {
          code: 'P1008',
          clientVersion: 'test',
        }),
      );

      await expect(write()).rejects.toBeInstanceOf(BookmarkStoreBusyError);
    });

    it.each([
      new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
      new Error('database is gone'),
    ])('passes other errors through', async (failure) => {
      bookmarkDelegate[method].mockRejectedValue(failure);

      await expect(write()).rejects.toBe(failure);
    });
  });

  it('updates and deletes by id', async () => {
    bookmarkDelegate.update.mockResolvedValue(bookmarkRecord);
    bookmarkDelegate.delete.mockResolvedValue(bookmarkRecord);

    await repository.update(bookmark.id, { title: 'Updated' });
    await repository.delete(bookmark.id);

    expect(bookmarkDelegate.update).toHaveBeenCalledWith({
      where: { id: bookmark.id },
      data: { title: 'Updated', metadata: undefined },
      include: { metadata: true },
    });
    expect(bookmarkDelegate.delete).toHaveBeenCalledWith({
      where: { id: bookmark.id },
    });
  });

  it('clears metadata when resetting after a URL change', async () => {
    bookmarkDelegate.update.mockResolvedValue(bookmarkRecord);

    await repository.update(bookmark.id, { url: 'https://example.com' }, true);

    expect(bookmarkDelegate.update).toHaveBeenCalledTimes(1);
  });
});
