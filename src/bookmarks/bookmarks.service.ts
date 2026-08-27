import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BookmarksRepository } from './bookmarks.repository';
import {
  Bookmark,
  BookmarkPage,
  CreateBookmarkData,
  UpdateBookmarkData,
} from './types/bookmark.types';

@Injectable()
export class BookmarksService {
  constructor(private readonly repository: BookmarksRepository) {}

  async create(data: CreateBookmarkData): Promise<Bookmark> {
    return this.repository.withTransaction(async (repository) => {
      if (await repository.findByUrl(data.url)) {
        throw new ConflictException('A bookmark with this URL already exists');
      }

      return repository.create(data);
    });
  }

  async findAll(page: number, limit: number): Promise<BookmarkPage> {
    const { data, total } = await this.repository.findPage(page, limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Bookmark> {
    const bookmark = await this.repository.findById(id);

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    return bookmark;
  }

  async update(id: string, data: UpdateBookmarkData): Promise<Bookmark> {
    if (Object.values(data).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }

    return this.repository.withTransaction(async (repository) => {
      const bookmark = await repository.findById(id);
      if (!bookmark) {
        throw new NotFoundException('Bookmark not found');
      }

      if (data.url !== undefined && data.url !== bookmark.url) {
        if (await repository.findByUrl(data.url)) {
          throw new ConflictException(
            'A bookmark with this URL already exists',
          );
        }
      }

      return repository.update(id, data);
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.withTransaction(async (repository) => {
      if (!(await repository.findById(id))) {
        throw new NotFoundException('Bookmark not found');
      }

      await repository.delete(id);
    });
  }
}
