import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BookmarkMetadataRepository } from './bookmark-metadata.repository';
import { MetadataFetchError } from './metadata-fetch.error';
import { PageMetadataFetcherService } from './page-metadata-fetcher.service';

const POLL_INTERVAL_MS = 1_000;
const MAX_JOBS_PER_RUN = 10;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30_000, 5 * 60_000];

@Injectable()
export class BookmarkMetadataWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BookmarkMetadataWorkerService.name);
  private timer?: NodeJS.Timeout;
  private activeRun?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly config: ConfigService,
    private readonly repository: BookmarkMetadataRepository,
    private readonly fetcher: PageMetadataFetcherService,
  ) {}

  onApplicationBootstrap(): void {
    const configured = this.config.get<string>('METADATA_WORKER_ENABLED');
    const enabled =
      configured === undefined
        ? this.config.get<string>('NODE_ENV') !== 'test'
        : configured.toLowerCase() !== 'false';

    if (enabled) {
      this.schedule(0);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    await this.activeRun;
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      this.activeRun = this.processAvailableJobs().finally(() => {
        this.activeRun = undefined;
        if (!this.stopping) {
          this.schedule(POLL_INTERVAL_MS);
        }
      });
    }, delay);
    this.timer.unref();
  }

  async processAvailableJobs(): Promise<void> {
    for (let index = 0; index < MAX_JOBS_PER_RUN; index += 1) {
      const job = await this.repository.claimNext();
      if (!job) {
        return;
      }

      try {
        const metadata = await this.fetcher.fetch(job.url);
        await this.repository.complete(job, metadata);
      } catch (error) {
        const fetchError =
          error instanceof MetadataFetchError
            ? error
            : new MetadataFetchError(
                'unexpected_error',
                true,
                error instanceof Error ? error.message : 'Unexpected error',
              );
        const retryAt = this.retryAt(job.attempt, fetchError.retryable);

        await this.repository.fail(
          job,
          `${fetchError.code}: ${fetchError.message}`,
          retryAt,
        );
        this.logger.warn(
          `Metadata fetch ${retryAt ? 'will retry' : 'failed'} for bookmark ${job.bookmarkId}: ${fetchError.code}`,
        );
      }
    }
  }

  private retryAt(attempt: number, retryable: boolean): Date | null {
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      return null;
    }

    return new Date(Date.now() + RETRY_DELAYS_MS[attempt - 1]);
  }
}
