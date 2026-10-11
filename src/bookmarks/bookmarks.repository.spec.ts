import { PrismaService } from '../prisma/prisma.service';
import { BookmarksRepository } from './bookmarks.repository';
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
    prisma = {
      bookmark: bookmarkDelegate,
      $transaction: jest.fn().mockImplementation((argument: unknown) => {
        if (typeof argument === 'function') {
          const callback = argument as (client: {
            bookmark: typeof transactionDelegate;
          }) => Promise<unknown>;
          return callback({ bookmark: transactionDelegate });
        }

        return Promise.all(argument as Promise<unknown>[]);
      }),
    };
    repository = new BookmarksRepository(prisma as unknown as PrismaService);
  });

  it('uses the transaction client supplied to withTransaction', async () => {
    transactionDelegate.findUnique.mockResolvedValue(bookmarkRecord);

    await repository.withTransaction((transaction) =>
      transaction.findByUrl(bookmark.url),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionDelegate.findUnique).toHaveBeenCalledWith({
      where: { url: bookmark.url },
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

  it('finds records by id and URL', async () => {
    bookmarkDelegate.findUnique.mockResolvedValue(bookmarkRecord);

    await repository.findById(bookmark.id);
    await repository.findByUrl(bookmark.url);

    expect(bookmarkDelegate.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: bookmark.id },
      include: { metadata: true },
    });
    expect(bookmarkDelegate.findUnique).toHaveBeenNthCalledWith(2, {
      where: { url: bookmark.url },
      include: { metadata: true },
    });
  });

  it('returns null for missing records', async () => {
    bookmarkDelegate.findUnique.mockResolvedValue(null);

    await expect(repository.findById(bookmark.id)).resolves.toBeNull();
    await expect(repository.findByUrl(bookmark.url)).resolves.toBeNull();
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
