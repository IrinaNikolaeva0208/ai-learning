export interface ClaimedMetadataJob {
  bookmarkId: string;
  url: string;
  lockToken: string;
  attempt: number;
}
