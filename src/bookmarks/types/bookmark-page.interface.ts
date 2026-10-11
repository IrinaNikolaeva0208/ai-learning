import { Bookmark } from './bookmark.interface';

export interface BookmarkPage {
  data: Bookmark[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
