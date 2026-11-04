import { BookmarkMapperService } from './bookmark.mapper.service';
import { BookmarkRecord } from './types/bookmark-record.type';

describe('BookmarkMapperService', () => {
  const mapper = new BookmarkMapperService();
  const record: BookmarkRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'NestJS',
    url: 'https://nestjs.com',
    description: null,
    metadata: {
      bookmarkId: '11111111-1111-4111-8111-111111111111',
      status: 'ready',
      pageTitle: 'NestJS',
      description: 'Framework',
      openGraphTitle: 'Nest',
      openGraphDescription: 'Description',
      openGraphImageUrl: 'https://nestjs.com/image.png',
      resolvedUrl: 'https://nestjs.com/',
      fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
      attempts: 1,
      nextAttemptAt: new Date('2026-01-01T00:00:00.000Z'),
      lockToken: null,
      leaseExpiresAt: null,
      lastError: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('maps a persistence record to a bookmark', () => {
    expect(mapper.toBookmark(record)).toEqual({
      id: record.id,
      title: record.title,
      url: record.url,
      description: record.description,
      metadata: {
        status: 'ready',
        pageTitle: 'NestJS',
        description: 'Framework',
        openGraph: {
          title: 'Nest',
          description: 'Description',
          imageUrl: 'https://nestjs.com/image.png',
        },
        resolvedUrl: 'https://nestjs.com/',
        fetchedAt: record.metadata?.fetchedAt,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  });

  it('maps pagination metadata', () => {
    expect(
      mapper.toBookmarkPage({ data: [record], total: 41 }, 2, 20),
    ).toMatchObject({
      data: [{ id: record.id }],
      meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
  });

  it('rejects a persistence record without required metadata', () => {
    expect(() => mapper.toBookmark({ ...record, metadata: null })).toThrow(
      `Bookmark ${record.id} has no metadata record`,
    );
  });
});
