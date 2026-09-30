export interface ExtractedPageMetadata {
  pageTitle: string | null;
  description: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphImageUrl: string | null;
  resolvedUrl: string;
}

export interface ClaimedMetadataJob {
  bookmarkId: string;
  url: string;
  lockToken: string;
  attempt: number;
}
