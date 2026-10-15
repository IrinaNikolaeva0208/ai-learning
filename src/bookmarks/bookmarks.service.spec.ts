import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './types/bookmark.interface';

describe('BookmarksService', () => {
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

  let repository: {
    withTransaction: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    findByUrl: jest.Mock;
    findPage: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let mapper: {
    toBookmark: jest.Mock;
    toBookmarkPage: jest.Mock;
  };
  let service: BookmarksService;

  beforeEach(() => {
    repository = {
      withTransaction: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByUrl: jest.fn(),
      findPage: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    repository.withTransaction.mockImplementation(
      (callback: (transaction: typeof repository) => unknown) =>
        callback(repository),
    );
    mapper = {
      toBookmark: jest.fn((value: Bookmark) => value),
      toBookmarkPage: jest.fn(
        (
          pageData: { data: Bookmark[]; total: number },
          page: number,
          limit: number,
        ) => ({
          data: pageData.data,
          meta: {
            page,
            limit,
            total: pageData.total,
            totalPages: Math.ceil(pageData.total / limit),
          },
        }),
      ),
    };
    service = new BookmarksService(
      repository as unknown as BookmarksRepository,
      mapper,
    );
  });

  describe('create', () => {
    it('checks the URL and creates in one transaction', async () => {
      repository.findByUrl.mockResolvedValue(null);
      repository.create.mockResolvedValue(bookmark);

      await expect(
        service.create({ title: bookmark.title, url: bookmark.url }),
      ).resolves.toBe(bookmark);
      expect(repository.withTransaction).toHaveBeenCalledTimes(1);
      expect(repository.findByUrl).toHaveBeenCalledWith(bookmark.url);
      expect(repository.create).toHaveBeenCalledWith({
        title: bookmark.title,
        url: bookmark.url,
      });
    });

    it('rejects a duplicate URL with 409', async () => {
      repository.findByUrl.mockResolvedValue(bookmark);

      await expect(
        service.create({ title: 'Duplicate', url: bookmark.url }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  it('returns pagination metadata', async () => {
    repository.findPage.mockResolvedValue({ data: [bookmark], total: 41 });

    await expect(service.findAll(2, 20)).resolves.toEqual({
      data: [bookmark],
      meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
  });

  describe('findOne', () => {
    it('returns an existing bookmark', async () => {
      repository.findById.mockResolvedValue(bookmark);

      await expect(service.findOne(bookmark.id)).resolves.toBe(bookmark);
    });

    it('throws 404 for a missing bookmark', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(bookmark.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects an empty patch before opening a transaction', async () => {
      await expect(
        service.update(bookmark.id, {
          title: undefined,
          url: undefined,
          description: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.withTransaction).not.toHaveBeenCalled();
    });

    it('throws 404 when the bookmark does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(bookmark.id, { title: 'New title' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('checks a changed URL and rejects a duplicate', async () => {
      repository.findById.mockResolvedValue(bookmark);
      repository.findByUrl.mockResolvedValue({
        ...bookmark,
        id: '22222222-2222-4222-8222-222222222222',
      });

      await expect(
        service.update(bookmark.id, { url: 'https://example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.findByUrl).toHaveBeenCalledWith('https://example.com');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates unchanged values without a duplicate lookup', async () => {
      const updated = { ...bookmark, updatedAt: new Date() };
      repository.findById.mockResolvedValue(bookmark);
      repository.update.mockResolvedValue(updated);

      await expect(
        service.update(bookmark.id, { url: bookmark.url }),
      ).resolves.toBe(updated);
      expect(repository.findByUrl).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        bookmark.id,
        { url: bookmark.url },
        false,
      );
    });

    it('resets metadata when the URL changes', async () => {
      const url = 'https://example.com';
      repository.findById.mockResolvedValue(bookmark);
      repository.findByUrl.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...bookmark, url });

      await service.update(bookmark.id, { url });

      expect(repository.update).toHaveBeenCalledWith(
        bookmark.id,
        { url },
        true,
      );
    });
  });

  describe('delete', () => {
    it('checks existence and deletes in one transaction', async () => {
      repository.findById.mockResolvedValue(bookmark);

      await expect(service.delete(bookmark.id)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(bookmark.id);
    });

    it('throws 404 when the bookmark does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete(bookmark.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
