import { BookmarkMetadata } from './bookmark-metadata.interface';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  metadata: BookmarkMetadata;
  createdAt: Date;
  updatedAt: Date;
}
