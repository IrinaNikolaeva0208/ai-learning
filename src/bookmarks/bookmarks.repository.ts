import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BookmarkStoreBusyError } from './bookmark-store-busy.error';
import { DuplicateBookmarkUrlError } from './duplicate-bookmark-url.error';
import { BookmarkPageData } from './types/bookmark-page-data.interface';
import { BookmarkRecord } from './types/bookmark-record.type';
import { CreateBookmarkData } from './types/create-bookmark-data.interface';
import { UpdateBookmarkData } from './types/update-bookmark-data.interface';

const bookmarkWithMetadata = {
  include: { metadata: true },
} satisfies Prisma.BookmarkDefaultArgs;

// Raw search SQL mirrors this order as `"createdAt" DESC, "id" DESC`.
const newestFirst = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.BookmarkOrderByWithRelationInput[];

const hasPrismaCode = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const UNIQUE_VIOLATION = 'P2002';
// SQLite reports a write that waited too long for its lock as a timeout.
const OPERATION_TIMED_OUT = 'P1008';

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
    return this.translatingWriteErrors(() =>
      this.bookmarks.create({
        data: { ...data, metadata: { create: {} } },
        ...bookmarkWithMetadata,
      }),
    );
  }

  findById(id: string): Promise<BookmarkRecord | null> {
    return this.bookmarks.findUnique({
      where: { id },
      ...bookmarkWithMetadata,
    });
  }

  async findPage(
    page: number,
    limit: number,
    search?: string,
  ): Promise<BookmarkPageData> {
    const skip = (page - 1) * limit;

    if (search !== undefined) {
      return this.findSearchPage(skip, limit, search);
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.bookmark.count(),
      this.prisma.bookmark.findMany({
        skip,
        take: limit,
        orderBy: newestFirst,
        ...bookmarkWithMetadata,
      }),
    ]);

    return { data, total };
  }

  private async findSearchPage(
    skip: number,
    limit: number,
    search: string,
  ): Promise<BookmarkPageData> {
    const matches = Prisma.sql`
      FROM "Bookmark"
      WHERE instr(lower("title"), lower(${search})) > 0
        OR instr(lower("url"), lower(${search})) > 0
        OR instr(lower("description"), lower(${search})) > 0
    `;

    return this.prisma.$transaction(async (transaction) => {
      const [{ total }] = await transaction.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS "total" ${matches}`,
      );
      const idRows = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id" ${matches}
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `,
      );
      const ids = idRows.map(({ id }) => id);
      const data =
        ids.length === 0
          ? []
          : await transaction.bookmark.findMany({
              where: { id: { in: ids } },
              orderBy: newestFirst,
              ...bookmarkWithMetadata,
            });

      return { data, total: Number(total) };
    });
  }

  async update(
    id: string,
    data: UpdateBookmarkData,
    resetMetadata = false,
  ): Promise<BookmarkRecord> {
    return this.translatingWriteErrors(() =>
      this.bookmarks.update({
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
      }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.bookmarks.delete({ where: { id } });
  }

  private async translatingWriteErrors<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (hasPrismaCode(error, UNIQUE_VIOLATION)) {
        throw new DuplicateBookmarkUrlError();
      }
      if (hasPrismaCode(error, OPERATION_TIMED_OUT)) {
        throw new BookmarkStoreBusyError();
      }
      throw error;
    }
  }
}
