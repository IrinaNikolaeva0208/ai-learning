import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BookmarkPageData } from './types/bookmark-page-data.interface';
import { BookmarkRecord } from './types/bookmark-record.type';
import { CreateBookmarkData } from './types/create-bookmark-data.interface';
import { UpdateBookmarkData } from './types/update-bookmark-data.interface';

const bookmarkWithMetadata = {
  include: { metadata: true },
} satisfies Prisma.BookmarkDefaultArgs;

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

  async create(data: CreateBookmarkData): Promise<BookmarkRecord> {
    return this.bookmarks.create({
      data: { ...data, metadata: { create: {} } },
      ...bookmarkWithMetadata,
    });
  }

  findById(id: string): Promise<BookmarkRecord | null> {
    return this.bookmarks.findUnique({
      where: { id },
      ...bookmarkWithMetadata,
    });
  }

  findByUrl(url: string): Promise<BookmarkRecord | null> {
    return this.bookmarks.findUnique({
      where: { url },
      ...bookmarkWithMetadata,
    });
  }

  async findPage(page: number, limit: number): Promise<BookmarkPageData> {
    const [total, data] = await this.prisma.$transaction([
      this.prisma.bookmark.count(),
      this.prisma.bookmark.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...bookmarkWithMetadata,
      }),
    ]);

    return { data, total };
  }

  async update(
    id: string,
    data: UpdateBookmarkData,
    resetMetadata = false,
  ): Promise<BookmarkRecord> {
    return this.bookmarks.update({
      where: { id },
      data: {
        ...data,
        metadata: resetMetadata
          ? {
              update: {
                status: 'pending',
                pageTitle: null,
                description: null,
                openGraphTitle: null,
                openGraphDescription: null,
                openGraphImageUrl: null,
                resolvedUrl: null,
                fetchedAt: null,
                attempts: 0,
                nextAttemptAt: new Date(),
                lockToken: null,
                leaseExpiresAt: null,
                lastError: null,
              },
            }
          : undefined,
      },
      ...bookmarkWithMetadata,
    });
  }

  async delete(id: string): Promise<void> {
    await this.bookmarks.delete({ where: { id } });
  }
}
