export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
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
