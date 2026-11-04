import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { BookmarkStoreBusyError } from './bookmark-store-busy.error';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';
import { DuplicateBookmarkUrlError } from './duplicate-bookmark-url.error';
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
    it('creates without opening a transaction', async () => {
      repository.create.mockResolvedValue(bookmark);

      await expect(
        service.create({ title: bookmark.title, url: bookmark.url }),
      ).resolves.toBe(bookmark);
      expect(repository.withTransaction).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({
        title: bookmark.title,
        url: bookmark.url,
      });
    });

    it('rejects a duplicate URL with 409', async () => {
      repository.create.mockRejectedValue(new DuplicateBookmarkUrlError());

      await expect(
        service.create({ title: 'Duplicate', url: bookmark.url }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('answers 503 when the store is busy', async () => {
      repository.create.mockRejectedValue(new BookmarkStoreBusyError());

      await expect(
        service.create({ title: 'Busy', url: bookmark.url }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('does not disguise other repository failures as conflicts', async () => {
      const failure = new Error('database is gone');
      repository.create.mockRejectedValue(failure);

      await expect(
        service.create({ title: 'Broken', url: bookmark.url }),
      ).rejects.toBe(failure);
    });
  });

  it('returns pagination metadata', async () => {
    repository.findPage.mockResolvedValue({ data: [bookmark], total: 41 });

    await expect(service.findAll(2, 20, 'Nest')).resolves.toEqual({
      data: [bookmark],
      meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
    expect(repository.findPage).toHaveBeenCalledWith(2, 20, 'Nest');
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
    it('rejects an empty patch before reading the bookmark', async () => {
      await expect(
        service.update(bookmark.id, {
          title: undefined,
          url: undefined,
          description: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws 404 when the bookmark does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(bookmark.id, { title: 'New title' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects changing to a URL that is already taken', async () => {
      repository.findById.mockResolvedValue(bookmark);
      repository.update.mockRejectedValue(new DuplicateBookmarkUrlError());

      await expect(
        service.update(bookmark.id, { url: 'https://example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.withTransaction).not.toHaveBeenCalled();
    });

    it('answers 503 when the store is busy', async () => {
      repository.findById.mockResolvedValue(bookmark);
      repository.update.mockRejectedValue(new BookmarkStoreBusyError());

      await expect(
        service.update(bookmark.id, { url: 'https://example.com' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('keeps metadata when the URL is unchanged', async () => {
      const updated = { ...bookmark, updatedAt: new Date() };
      repository.findById.mockResolvedValue(bookmark);
      repository.update.mockResolvedValue(updated);

      await expect(
        service.update(bookmark.id, { url: bookmark.url }),
      ).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(
        bookmark.id,
        { url: bookmark.url },
        false,
      );
    });

    it('resets metadata when the URL changes', async () => {
      const url = 'https://example.com';
      repository.findById.mockResolvedValue(bookmark);
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
