import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { ClaimedMetadataJob } from './types/claimed-metadata-job.interface';
import { ExtractedPageMetadata } from './types/extracted-page-metadata.interface';

const LEASE_MS = 30_000;

@Injectable()
export class BookmarkMetadataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimNext(now = new Date()): Promise<ClaimedMetadataJob | null> {
    const candidate = await this.prisma.bookmarkMetadata.findFirst({
      where: {
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', leaseExpiresAt: { lte: now } },
        ],
      },
      include: { bookmark: true },
      orderBy: [{ nextAttemptAt: 'asc' }, { bookmarkId: 'asc' }],
    });
    if (!candidate) {
      return null;
    }

    const lockToken = randomUUID();
    const claimed = await this.prisma.bookmarkMetadata.updateMany({
      where: {
        bookmarkId: candidate.bookmarkId,
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', leaseExpiresAt: { lte: now } },
        ],
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        lockToken,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    });
    if (claimed.count !== 1) {
      return null;
    }

    return {
      bookmarkId: candidate.bookmarkId,
      url: candidate.bookmark.url,
      lockToken,
      attempt: candidate.attempts + 1,
    };
  }

  async complete(
    job: ClaimedMetadataJob,
    metadata: ExtractedPageMetadata,
    fetchedAt = new Date(),
  ): Promise<boolean> {
    const result = await this.prisma.bookmarkMetadata.updateMany({
      where: {
        bookmarkId: job.bookmarkId,
        status: 'processing',
        lockToken: job.lockToken,
      },
      data: {
        status: 'ready',
        ...metadata,
        fetchedAt,
        lockToken: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });

    return result.count === 1;
  }

  async fail(
    job: ClaimedMetadataJob,
    error: string,
    retryAt: Date | null,
  ): Promise<boolean> {
    const result = await this.prisma.bookmarkMetadata.updateMany({
      where: {
        bookmarkId: job.bookmarkId,
        status: 'processing',
        lockToken: job.lockToken,
      },
      data: {
        status: retryAt ? 'pending' : 'failed',
        nextAttemptAt: retryAt ?? undefined,
        lockToken: null,
        leaseExpiresAt: null,
        lastError: error.slice(0, 1_000),
      },
    });

    return result.count === 1;
  }
}
