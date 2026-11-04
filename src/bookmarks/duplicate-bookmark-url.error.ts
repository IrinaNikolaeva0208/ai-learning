export class DuplicateBookmarkUrlError extends Error {
  constructor() {
    super('A bookmark with this URL already exists');
  }
}
