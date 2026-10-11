import { PrismaService } from '../../prisma/prisma.service';
import { BookmarkMetadataRepository } from './bookmark-metadata.repository';
import { ClaimedMetadataJob } from './types/claimed-metadata-job.interface';
import { ExtractedPageMetadata } from './types/extracted-page-metadata.interface';

describe('BookmarkMetadataRepository', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const job: ClaimedMetadataJob = {
    bookmarkId: '11111111-1111-4111-8111-111111111111',
    url: 'https://example.com',
    lockToken: 'lock-token',
    attempt: 1,
  };
  const metadata: ExtractedPageMetadata = {
    pageTitle: 'Example',
    description: null,
    openGraphTitle: null,
    openGraphDescription: null,
    openGraphImageUrl: null,
    resolvedUrl: 'https://example.com/',
  };

  let delegate: { findFirst: jest.Mock; updateMany: jest.Mock };
  let repository: BookmarkMetadataRepository;

  beforeEach(() => {
    delegate = { findFirst: jest.fn(), updateMany: jest.fn() };
    repository = new BookmarkMetadataRepository({
      bookmarkMetadata: delegate,
    } as unknown as PrismaService);
  });

  it('returns null when no job is due', async () => {
    delegate.findFirst.mockResolvedValue(null);

    await expect(repository.claimNext(now)).resolves.toBeNull();
    expect(delegate.updateMany).not.toHaveBeenCalled();
  });

  it('uses current timestamps when none are supplied', async () => {
    delegate.findFirst.mockResolvedValue(null);
    await repository.claimNext();
    expect(delegate.findFirst).toHaveBeenCalledTimes(1);

    delegate.updateMany.mockResolvedValue({ count: 1 });
    await repository.complete(job, metadata);
    expect(delegate.updateMany).toHaveBeenCalledTimes(1);
  });

  it('atomically claims a due or expired job with a lease token', async () => {
    delegate.findFirst.mockResolvedValue({
      bookmarkId: job.bookmarkId,
      attempts: 1,
      bookmark: { url: job.url },
    });
    delegate.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await repository.claimNext(now);

    expect(typeof claimed?.lockToken).toBe('string');
    expect(claimed).toEqual({
      ...job,
      lockToken: claimed?.lockToken,
      attempt: 2,
    });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: {
        bookmarkId: job.bookmarkId,
        OR: [
          { status: 'pending', nextAttemptAt: { lte: now } },
          { status: 'processing', leaseExpiresAt: { lte: now } },
        ],
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        lockToken: claimed?.lockToken,
        leaseExpiresAt: new Date('2026-01-01T00:00:30.000Z'),
      },
    });
  });

  it('returns null when another worker wins the claim', async () => {
    delegate.findFirst.mockResolvedValue({
      bookmarkId: job.bookmarkId,
      attempts: 0,
      bookmark: { url: job.url },
    });
    delegate.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.claimNext(now)).resolves.toBeNull();
  });

  it('completes only the currently locked job', async () => {
    delegate.updateMany.mockResolvedValue({ count: 1 });

    await expect(repository.complete(job, metadata, now)).resolves.toBe(true);
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: {
        bookmarkId: job.bookmarkId,
        status: 'processing',
        lockToken: job.lockToken,
      },
      data: {
        status: 'ready',
        ...metadata,
        fetchedAt: now,
        lockToken: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });

    delegate.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.complete(job, metadata, now)).resolves.toBe(false);
  });

  it('reschedules retryable jobs and caps stored errors', async () => {
    const retryAt = new Date('2026-01-01T00:00:30.000Z');
    delegate.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.fail(job, 'x'.repeat(1_100), retryAt),
    ).resolves.toBe(true);
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: {
        bookmarkId: job.bookmarkId,
        status: 'processing',
        lockToken: job.lockToken,
      },
      data: {
        status: 'pending',
        nextAttemptAt: retryAt,
        lockToken: null,
        leaseExpiresAt: null,
        lastError: 'x'.repeat(1_000),
      },
    });
  });

  it('marks exhausted jobs failed and reports stale locks', async () => {
    delegate.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(repository.fail(job, 'terminal', null)).resolves.toBe(true);
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: {
        bookmarkId: job.bookmarkId,
        status: 'processing',
        lockToken: job.lockToken,
      },
      data: {
        status: 'failed',
        nextAttemptAt: undefined,
        lockToken: null,
        leaseExpiresAt: null,
        lastError: 'terminal',
      },
    });
    await expect(repository.fail(job, 'stale', null)).resolves.toBe(false);
  });
});
