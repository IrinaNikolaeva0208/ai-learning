import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  Bookmark,
  BookmarkPageData,
  CreateBookmarkData,
  UpdateBookmarkData,
} from './types/bookmark.types';

@Injectable()
export class BookmarksRepository {
  private transactionClient?: Prisma.TransactionClient;

  constructor(private readonly prisma: PrismaService) {}

  private get bookmarks(): Prisma.TransactionClient['bookmark'] {
    return (this.transactionClient ?? this.prisma).bookmark;
  }

  async withTransaction<T>(
    callback: (repository: BookmarksRepository) => Promise<T>,
  ): Promise<T> {
    if (this.transactionClient) {
      return callback(this);
    }

    return this.prisma.$transaction(async (transaction) => {
      const repository = new BookmarksRepository(this.prisma);
      repository.transactionClient = transaction;
      return callback(repository);
    });
  }

  async create(data: CreateBookmarkData): Promise<Bookmark> {
    return this.bookmarks.create({ data });
  }

  async findById(id: string): Promise<Bookmark | null> {
    return this.bookmarks.findUnique({ where: { id } });
  }

  async findByUrl(url: string): Promise<Bookmark | null> {
    return this.bookmarks.findUnique({ where: { url } });
  }

  async findPage(page: number, limit: number): Promise<BookmarkPageData> {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.bookmark.count(),
      this.prisma.bookmark.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    return { data, total };
  }

  async update(id: string, data: UpdateBookmarkData): Promise<Bookmark> {
    return this.bookmarks.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.bookmarks.delete({ where: { id } });
  }
}
