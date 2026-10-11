import { BookmarkMetadataStatus } from './bookmark-metadata-status.type';

export interface BookmarkMetadata {
  status: BookmarkMetadataStatus;
  pageTitle: string | null;
  description: string | null;
  openGraph: {
    title: string | null;
    description: string | null;
    imageUrl: string | null;
  };
  resolvedUrl: string | null;
  fetchedAt: Date | null;
}
