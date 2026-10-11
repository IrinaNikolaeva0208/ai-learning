import { Prisma } from '@prisma/client';

export type BookmarkRecord = Prisma.BookmarkGetPayload<{
  include: { metadata: true };
}>;
