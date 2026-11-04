import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { BookmarkStoreBusyError } from './bookmark-store-busy.error';
import { BookmarksRepository } from './bookmarks.repository';
import { DuplicateBookmarkUrlError } from './duplicate-bookmark-url.error';
import { BookmarkMapperService } from './bookmark.mapper.service';
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
    return this.mapper.toBookmark(
      await this.translatingWriteErrors(() => this.repository.create(data)),
    );
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

    const bookmark = await this.repository.findById(id);
    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    const updated = await this.translatingWriteErrors(() =>
      this.repository.update(
        id,
        data,
        data.url !== undefined && data.url !== bookmark.url,
      ),
    );
    return this.mapper.toBookmark(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repository.withTransaction(async (repository) => {
      if (!(await repository.findById(id))) {
        throw new NotFoundException('Bookmark not found');
      }

      await repository.delete(id);
    });
  }

  // URL uniqueness is decided only by the database constraint. Interactive
  // transactions queue on SQLite and time out under concurrent load.
  private async translatingWriteErrors<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof DuplicateBookmarkUrlError) {
        throw new ConflictException('A bookmark with this URL already exists');
      }
      if (error instanceof BookmarkStoreBusyError) {
        throw new ServiceUnavailableException(
          'The database is busy, please retry',
        );
      }
      throw error;
    }
  }
}
