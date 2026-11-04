import { Module } from '@nestjs/common';
import { BookmarkMapperService } from './bookmark.mapper.service';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';
import { BookmarkMetadataRepository } from './metadata/bookmark-metadata.repository';
import { BookmarkMetadataWorkerService } from './metadata/bookmark-metadata-worker.service';
import { PageMetadataExtractorService } from './metadata/page-metadata-extractor.service';
import { PageMetadataFetcherService } from './metadata/page-metadata-fetcher.service';

@Module({
  controllers: [BookmarksController],
  providers: [
    BookmarksService,
    BookmarksRepository,
    BookmarkMapperService,
    BookmarkMetadataRepository,
    BookmarkMetadataWorkerService,
    PageMetadataExtractorService,
    PageMetadataFetcherService,
  ],
})
export class BookmarksModule {}
