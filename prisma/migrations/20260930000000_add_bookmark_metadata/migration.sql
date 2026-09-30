-- CreateTable
CREATE TABLE "BookmarkMetadata" (
    "bookmarkId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pageTitle" TEXT,
    "description" TEXT,
    "openGraphTitle" TEXT,
    "openGraphDescription" TEXT,
    "openGraphImageUrl" TEXT,
    "resolvedUrl" TEXT,
    "fetchedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookmarkMetadata_bookmarkId_fkey" FOREIGN KEY ("bookmarkId") REFERENCES "Bookmark" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Existing bookmarks should be enriched after this migration is deployed.
INSERT INTO "BookmarkMetadata" ("bookmarkId")
SELECT "id" FROM "Bookmark";

-- CreateIndex
CREATE INDEX "BookmarkMetadata_status_nextAttemptAt_idx" ON "BookmarkMetadata"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BookmarkMetadata_status_leaseExpiresAt_idx" ON "BookmarkMetadata"("status", "leaseExpiresAt");
