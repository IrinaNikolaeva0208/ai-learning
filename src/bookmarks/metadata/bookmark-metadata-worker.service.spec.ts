import { ConfigService } from '@nestjs/config';

import { BookmarkMetadataRepository } from './bookmark-metadata.repository';
import { BookmarkMetadataWorkerService } from './bookmark-metadata-worker.service';
import { MetadataFetchError } from './metadata-fetch.error';
import { PageMetadataFetcherService } from './page-metadata-fetcher.service';
import { ClaimedMetadataJob } from './types/claimed-metadata-job.interface';

describe('BookmarkMetadataWorkerService', () => {
  const job: ClaimedMetadataJob = {
    bookmarkId: '11111111-1111-4111-8111-111111111111',
    url: 'https://example.com',
    lockToken: 'lock-token',
    attempt: 1,
  };
  const metadata = {
    pageTitle: 'Example',
    description: null,
    openGraphTitle: null,
    openGraphDescription: null,
    openGraphImageUrl: null,
    resolvedUrl: 'https://example.com/',
  };

  let config: { get: jest.Mock };
  let repository: {
    claimNext: jest.Mock;
    complete: jest.Mock;
    fail: jest.Mock;
  };
  let fetcher: { fetch: jest.Mock };
  let worker: BookmarkMetadataWorkerService;

  beforeEach(() => {
    config = { get: jest.fn() };
    repository = {
      claimNext: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
    };
    fetcher = { fetch: jest.fn() };
    worker = new BookmarkMetadataWorkerService(
      config as unknown as ConfigService,
      repository as unknown as BookmarkMetadataRepository,
      fetcher as unknown as PageMetadataFetcherService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('processes jobs until the queue is empty', async () => {
    repository.claimNext.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    fetcher.fetch.mockResolvedValue(metadata);

    await worker.processAvailableJobs();

    expect(fetcher.fetch).toHaveBeenCalledWith(job.url);
    expect(repository.complete).toHaveBeenCalledWith(job, metadata);
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it('retries a transient failure after the first attempt', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01').getTime());
    repository.claimNext.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    fetcher.fetch.mockRejectedValue(
      new MetadataFetchError('network_error', true, 'offline'),
    );

    await worker.processAvailableJobs();

    expect(repository.fail).toHaveBeenCalledWith(
      job,
      'network_error: offline',
      new Date('2026-01-01T00:00:30.000Z'),
    );
  });

  it.each([
    [new MetadataFetchError('blocked_url', false, 'blocked'), 1, 'blocked_url'],
    [new Error('broken'), 3, 'unexpected_error'],
    ['broken', 3, 'unexpected_error'],
  ])(
    'marks terminal or exhausted failures as failed',
    async (error, attempt, code) => {
      const claimed = { ...job, attempt };
      repository.claimNext
        .mockResolvedValueOnce(claimed)
        .mockResolvedValueOnce(null);
      fetcher.fetch.mockRejectedValue(error);

      await worker.processAvailableJobs();

      expect(repository.fail).toHaveBeenCalledWith(
        claimed,
        expect.stringContaining(`${code}:`),
        null,
      );
    },
  );

  it('caps each polling run at ten jobs', async () => {
    repository.claimNext.mockResolvedValue(job);
    fetcher.fetch.mockResolvedValue(metadata);

    await worker.processAvailableJobs();

    expect(repository.claimNext).toHaveBeenCalledTimes(10);
  });

  it('does not start the loop when explicitly disabled', async () => {
    jest.useFakeTimers();
    config.get.mockReturnValue('false');

    worker.onApplicationBootstrap();
    jest.runOnlyPendingTimers();
    await worker.onApplicationShutdown();

    expect(repository.claimNext).not.toHaveBeenCalled();
  });

  it('defaults to disabled in tests and starts when enabled', async () => {
    jest.useFakeTimers();
    config.get.mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'test' : undefined,
    );
    worker.onApplicationBootstrap();
    jest.runOnlyPendingTimers();
    expect(repository.claimNext).not.toHaveBeenCalled();

    config.get.mockReturnValue('true');
    repository.claimNext.mockResolvedValue(null);
    worker.onApplicationBootstrap();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await worker.onApplicationShutdown();

    expect(repository.claimNext).toHaveBeenCalledTimes(1);
  });

  it('schedules another poll after a completed run', async () => {
    jest.useFakeTimers();
    config.get.mockReturnValue('true');
    repository.claimNext.mockResolvedValue(null);

    worker.onApplicationBootstrap();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(jest.getTimerCount()).toBe(1);
    await worker.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
  });
});
