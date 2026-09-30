import { Module } from '@nestjs/common';

import { BookmarkMetadataRepository } from './bookmark-metadata.repository';
import { BookmarkMetadataWorker } from './bookmark-metadata.worker';
import { PageMetadataExtractor } from './page-metadata.extractor';
import { PageMetadataFetcher } from './page-metadata.fetcher';

@Module({
  providers: [
    BookmarkMetadataRepository,
    BookmarkMetadataWorker,
    PageMetadataExtractor,
    PageMetadataFetcher,
  ],
})
export class BookmarkMetadataModule {}
