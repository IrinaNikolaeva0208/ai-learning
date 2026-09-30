import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  Bookmark,
  BookmarkMetadataStatus,
  BookmarkPageData,
  CreateBookmarkData,
  UpdateBookmarkData,
} from './types/bookmark.types';

const bookmarkWithMetadata = {
  include: { metadata: true },
} satisfies Prisma.BookmarkDefaultArgs;

type BookmarkRecord = Prisma.BookmarkGetPayload<typeof bookmarkWithMetadata>;

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
    const bookmark = await this.bookmarks.create({
      data: { ...data, metadata: { create: {} } },
      ...bookmarkWithMetadata,
    });

    return this.toBookmark(bookmark);
  }

  async findById(id: string): Promise<Bookmark | null> {
    const bookmark = await this.bookmarks.findUnique({
      where: { id },
      ...bookmarkWithMetadata,
    });

    return bookmark ? this.toBookmark(bookmark) : null;
  }

  async findByUrl(url: string): Promise<Bookmark | null> {
    const bookmark = await this.bookmarks.findUnique({
      where: { url },
      ...bookmarkWithMetadata,
    });

    return bookmark ? this.toBookmark(bookmark) : null;
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

    return { data: data.map((bookmark) => this.toBookmark(bookmark)), total };
  }

  async update(
    id: string,
    data: UpdateBookmarkData,
    resetMetadata = false,
  ): Promise<Bookmark> {
    const bookmark = await this.bookmarks.update({
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

    return this.toBookmark(bookmark);
  }

  async delete(id: string): Promise<void> {
    await this.bookmarks.delete({ where: { id } });
  }

  private toBookmark(record: BookmarkRecord): Bookmark {
    if (!record.metadata) {
      throw new Error(`Bookmark ${record.id} has no metadata record`);
    }

    return {
      id: record.id,
      title: record.title,
      url: record.url,
      description: record.description,
      metadata: {
        status: record.metadata.status as BookmarkMetadataStatus,
        pageTitle: record.metadata.pageTitle,
        description: record.metadata.description,
        openGraph: {
          title: record.metadata.openGraphTitle,
          description: record.metadata.openGraphDescription,
          imageUrl: record.metadata.openGraphImageUrl,
        },
        resolvedUrl: record.metadata.resolvedUrl,
        fetchedAt: record.metadata.fetchedAt,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
