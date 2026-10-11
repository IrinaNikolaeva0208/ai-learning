import { promises as dns } from 'node:dns';
import { Agent, fetch, Response } from 'undici';

import { MetadataFetchError } from './metadata-fetch.error';
import { PageMetadataExtractorService } from './page-metadata-extractor.service';
import { PageMetadataFetcherService } from './page-metadata-fetcher.service';
import { createPinnedLookup } from './pinned-lookup.factory';

jest.mock('undici', () => {
  const actual = jest.requireActual<typeof import('undici')>('undici');
  return {
    ...actual,
    Agent: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
    fetch: jest.fn(),
  };
});

describe('PageMetadataFetcherService', () => {
  type LookupAll = (
    hostname: string,
    options: { all: true; verbatim: true },
  ) => Promise<Array<{ address: string; family: 4 | 6 }>>;

  const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
  const mockedAgent = Agent as unknown as jest.Mock;
  let fetcher: PageMetadataFetcherService;

  beforeEach(() => {
    fetcher = new PageMetadataFetcherService(
      new PageMetadataExtractorService(),
    );
    mockedFetch.mockReset();
    mockedAgent.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches HTML with a pinned dispatcher and extracts metadata', async () => {
    mockedFetch.mockResolvedValue(
      new Response('<title>Example</title>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    await expect(fetcher.fetch('https://93.184.216.34/page')).resolves.toEqual(
      expect.objectContaining({
        pageTitle: 'Example',
        resolvedUrl: 'https://93.184.216.34/page',
      }),
    );
    expect(mockedFetch).toHaveBeenCalledWith(
      new URL('https://93.184.216.34/page'),
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(mockedAgent).toHaveBeenCalledTimes(1);
  });

  it('follows and revalidates redirects', async () => {
    mockedFetch
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://1.1.1.1/final' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>Final</title>', {
          headers: { 'content-type': 'application/xhtml+xml' },
        }),
      );

    await expect(fetcher.fetch('https://93.184.216.34')).resolves.toEqual(
      expect.objectContaining({
        pageTitle: 'Final',
        resolvedUrl: 'https://1.1.1.1/final',
      }),
    );
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['ftp://93.184.216.34', 'Only HTTP and HTTPS'],
    ['https://user:password@93.184.216.34', 'credentials'],
    ['https://93.184.216.34:8443', 'standard HTTP'],
    ['http://127.0.0.1', 'non-public'],
    ['http://[::1]', 'non-public'],
  ])('blocks unsafe URL %s', async (url, message) => {
    const result = fetcher.fetch(url);
    await expect(result).rejects.toMatchObject({
      code: 'blocked_url',
      retryable: false,
    });
    await expect(result).rejects.toThrow(message);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('rejects hosts with empty or non-public DNS answers', async () => {
    const lookup = jest.spyOn(
      dns,
      'lookup',
    ) as unknown as jest.MockedFunction<LookupAll>;
    lookup.mockResolvedValueOnce([]);

    await expect(fetcher.fetch('https://empty.example')).rejects.toMatchObject({
      code: 'blocked_url',
    });

    lookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(fetcher.fetch('https://mixed.example')).rejects.toMatchObject({
      code: 'blocked_url',
    });

    lookup.mockResolvedValueOnce([{ address: 'not-an-ip', family: 4 }]);
    await expect(
      fetcher.fetch('https://invalid.example'),
    ).rejects.toMatchObject({ code: 'blocked_url' });
  });

  it('supports public IPv6 destinations and empty response bodies', async () => {
    mockedFetch.mockResolvedValue(
      new Response(null, { headers: { 'content-type': 'text/html' } }),
    );

    await expect(
      fetcher.fetch('https://[2606:4700:4700::1111]'),
    ).resolves.toEqual({
      pageTitle: null,
      description: null,
      openGraphTitle: null,
      openGraphDescription: null,
      openGraphImageUrl: null,
      resolvedUrl: 'https://[2606:4700:4700::1111]/',
    });
  });

  it('pins all requested address families in the dispatcher lookup', () => {
    const lookup = createPinnedLookup([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);

    const allCallback = jest.fn();
    lookup('example.com', { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);

    const ipv6Callback = jest.fn();
    lookup('example.com', { family: 6, all: false }, ipv6Callback);
    expect(ipv6Callback).toHaveBeenCalledWith(null, '2606:4700:4700::1111', 6);

    const fallbackCallback = jest.fn();
    lookup('example.com', { family: 7, all: false }, fallbackCallback);
    expect(fallbackCallback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it.each([
    [404, false],
    [408, true],
    [425, true],
    [429, true],
    [503, true],
  ])('classifies HTTP %i failures', async (status, retryable) => {
    mockedFetch.mockResolvedValue(new Response(null, { status }));

    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toMatchObject({
      code: 'http_error',
      retryable,
    });
  });

  it('rejects invalid redirects and unsupported content', async () => {
    mockedFetch.mockResolvedValueOnce(new Response(null, { status: 302 }));
    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toMatchObject({
      code: 'invalid_redirect',
      retryable: false,
    });

    mockedFetch.mockResolvedValueOnce(
      new Response('plain text', {
        headers: { 'content-type': 'text/plain' },
      }),
    );
    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toMatchObject({
      code: 'unsupported_content_type',
      retryable: false,
    });
  });

  it('enforces declared and streamed body limits', async () => {
    mockedFetch.mockResolvedValueOnce(
      new Response('small', {
        headers: {
          'content-type': 'text/html',
          'content-length': `${1024 * 1024 + 1}`,
        },
      }),
    );
    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toMatchObject({
      code: 'body_too_large',
    });

    mockedFetch.mockResolvedValueOnce(
      new Response(Buffer.alloc(1024 * 1024 + 1), {
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toMatchObject({
      code: 'body_too_large',
    });
  });

  it('wraps DNS and transport failures as retryable network errors', async () => {
    const lookup = jest.spyOn(
      dns,
      'lookup',
    ) as unknown as jest.MockedFunction<LookupAll>;
    lookup.mockRejectedValue(new Error('DNS unavailable'));
    await expect(fetcher.fetch('https://dns.example')).rejects.toMatchObject({
      code: 'network_error',
      retryable: true,
    });

    mockedFetch.mockRejectedValue('offline');
    await expect(fetcher.fetch('https://93.184.216.34')).rejects.toEqual(
      new MetadataFetchError('network_error', true, 'Fetch failed'),
    );
  });
});
