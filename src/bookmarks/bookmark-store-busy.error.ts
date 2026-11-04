export class BookmarkStoreBusyError extends Error {
  constructor() {
    super('The bookmark store is busy');
  }
}
