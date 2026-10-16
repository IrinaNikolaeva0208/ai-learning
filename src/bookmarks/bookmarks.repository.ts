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

  async findPage(
    page: number,
    limit: number,
    search?: string,
  ): Promise<BookmarkPageData> {
    if (search !== undefined) {
      return this.findSearchPage(page, limit, search);
    }

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

  private async findSearchPage(
    page: number,
    limit: number,
    search: string,
  ): Promise<BookmarkPageData> {
    const predicate = Prisma.sql`
      instr(lower("title"), lower(${search})) > 0
      OR instr(lower("url"), lower(${search})) > 0
      OR instr(lower("description"), lower(${search})) > 0
    `;

    return this.prisma.$transaction(async (transaction) => {
      const [countRows, idRows] = await Promise.all([
        transaction.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS "total"
          FROM "Bookmark"
          WHERE ${predicate}
        `),
        transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "Bookmark"
          WHERE ${predicate}
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT ${limit}
          OFFSET ${(page - 1) * limit}
        `),
      ]);
      const ids = idRows.map(({ id }) => id);
      const data =
        ids.length === 0
          ? []
          : await transaction.bookmark.findMany({
              where: { id: { in: ids } },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              ...bookmarkWithMetadata,
            });

      return {
        data,
        total: Number(countRows[0].total),
      };
    });
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
