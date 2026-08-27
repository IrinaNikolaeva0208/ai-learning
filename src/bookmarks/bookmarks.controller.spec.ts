import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './types/bookmark.types';

describe('BookmarksController', () => {
  const bookmark: Bookmark = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'NestJS',
    url: 'https://nestjs.com',
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let controller: BookmarksController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    controller = new BookmarksController(
      service as unknown as BookmarksService,
    );
  });

  it('delegates create and list requests', async () => {
    const page = {
      data: [bookmark],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    service.create.mockResolvedValue(bookmark);
    service.findAll.mockResolvedValue(page);

    await expect(
      controller.create({ title: bookmark.title, url: bookmark.url }),
    ).resolves.toBe(bookmark);
    await expect(controller.findAll({ page: 1, limit: 20 })).resolves.toBe(
      page,
    );
    expect(service.findAll).toHaveBeenCalledWith(1, 20);
  });

  it('delegates item reads, updates and deletes', async () => {
    service.findOne.mockResolvedValue(bookmark);
    service.update.mockResolvedValue(bookmark);
    service.delete.mockResolvedValue(undefined);

    await expect(controller.findOne(bookmark.id)).resolves.toBe(bookmark);
    await expect(
      controller.update(bookmark.id, { title: 'Updated' }),
    ).resolves.toBe(bookmark);
    await expect(controller.delete(bookmark.id)).resolves.toBeUndefined();

    expect(service.findOne).toHaveBeenCalledWith(bookmark.id);
    expect(service.update).toHaveBeenCalledWith(bookmark.id, {
      title: 'Updated',
    });
    expect(service.delete).toHaveBeenCalledWith(bookmark.id);
  });
});
