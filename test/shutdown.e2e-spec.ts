import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { BookmarkMetadataRepository } from '../src/bookmarks/metadata/bookmark-metadata.repository';
import { PageMetadataFetcherService } from '../src/bookmarks/metadata/page-metadata-fetcher.service';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const metadata = {
  pageTitle: 'Example',
  description: null,
  openGraphTitle: null,
  openGraphDescription: null,
  openGraphImageUrl: null,
  resolvedUrl: 'https://example.com/',
};

const SHUTDOWN_SETTLE_MS = 200;

describe('Graceful shutdown (e2e)', () => {
  // Reads the outcome after the application's own client has disconnected.
  const observer = new PrismaClient();

  beforeEach(async () => {
    await observer.bookmark.deleteMany();
  });

  afterAll(async () => {
    await observer.$disconnect();
  });

  it('finishes the in-flight job, claims no more, then disconnects Prisma', async () => {
    for (const name of ['first', 'second']) {
      await observer.bookmark.create({
        data: {
          title: name,
          url: `https://example.com/${name}`,
          metadata: { create: {} },
        },
      });
    }

    let fetchStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    let releaseFetch: () => void = () => undefined;
    const release = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetch = jest.fn(async () => {
      fetchStarted();
      await release;
      return metadata;
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'METADATA_WORKER_ENABLED' ? 'true' : undefined,
      })
      .overrideProvider(PageMetadataFetcherService)
      .useValue({ fetch })
      .compile();
    const app: INestApplication = moduleFixture.createNestApplication();
    configureApp(app);
    const complete = jest.spyOn(
      app.get(BookmarkMetadataRepository),
      'complete',
    );
    const disconnect = jest.spyOn(app.get(PrismaService), '$disconnect');

    await app.init();
    await started;

    const closed = app.close();
    // Give every shutdown phase that does not wait for the worker time to run.
    await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_SETTLE_MS));
    expect(disconnect).not.toHaveBeenCalled();

    releaseFetch();
    await closed;

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(complete.mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0],
    );
    const statuses = await observer.bookmarkMetadata.findMany({
      select: { status: true, lockToken: true },
      orderBy: { status: 'asc' },
    });
    expect(statuses).toEqual([
      { status: 'pending', lockToken: null },
      { status: 'ready', lockToken: null },
    ]);
  });
});
