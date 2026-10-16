import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BookmarksRepository } from './bookmarks.repository';
import { BookmarkMapperService } from './bookmark-mapper.service';
import { BookmarkPage } from './types/bookmark-page.interface';
import { Bookmark } from './types/bookmark.interface';
import { CreateBookmarkData } from './types/create-bookmark-data.interface';
import { UpdateBookmarkData } from './types/update-bookmark-data.interface';

@Injectable()
export class BookmarksService {
  constructor(
    private readonly repository: BookmarksRepository,
    private readonly mapper: BookmarkMapperService,
  ) {}

  async create(data: CreateBookmarkData): Promise<Bookmark> {
    return this.repository.withTransaction(async (repository) => {
      if (await repository.findByUrl(data.url)) {
        throw new ConflictException('A bookmark with this URL already exists');
      }

      return this.mapper.toBookmark(await repository.create(data));
    });
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
  ): Promise<BookmarkPage> {
    const pageData = await this.repository.findPage(page, limit, search);
    return this.mapper.toBookmarkPage(pageData, page, limit);
  }

  async findOne(id: string): Promise<Bookmark> {
    const bookmark = await this.repository.findById(id);

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    return this.mapper.toBookmark(bookmark);
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

      const updated = await repository.update(
        id,
        data,
        data.url !== undefined && data.url !== bookmark.url,
      );
      return this.mapper.toBookmark(updated);
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
