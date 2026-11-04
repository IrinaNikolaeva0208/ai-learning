import { Injectable } from '@nestjs/common';

import { BookmarkMetadataStatus } from './types/bookmark-metadata-status.type';
import { BookmarkPageData } from './types/bookmark-page-data.interface';
import { BookmarkPage } from './types/bookmark-page.interface';
import { BookmarkRecord } from './types/bookmark-record.type';
import { Bookmark } from './types/bookmark.interface';

@Injectable()
export class BookmarkMapperService {
  toBookmark(record: BookmarkRecord): Bookmark {
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

  toBookmarkPage(
    pageData: BookmarkPageData,
    page: number,
    limit: number,
  ): BookmarkPage {
    return {
      data: pageData.data.map((record) => this.toBookmark(record)),
      meta: {
        page,
        limit,
        total: pageData.total,
        totalPages: Math.ceil(pageData.total / limit),
      },
    };
  }
}
