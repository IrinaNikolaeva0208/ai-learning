export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  metadata: BookmarkMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type BookmarkMetadataStatus =
  'pending' | 'processing' | 'ready' | 'failed';

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

export interface CreateBookmarkData {
  title: string;
  url: string;
  description?: string | null;
}

export interface UpdateBookmarkData {
  title?: string;
  url?: string;
  description?: string | null;
}

export interface BookmarkPage {
  data: Bookmark[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BookmarkPageData {
  data: Bookmark[];
  total: number;
}
