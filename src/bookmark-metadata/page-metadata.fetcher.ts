import { Injectable } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';

import { ExtractedPageMetadata } from './bookmark-metadata.types';
import { PageMetadataExtractor } from './page-metadata.extractor';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export function createPinnedLookup(
  addresses: ResolvedAddress[],
): LookupFunction {
  return (_hostname, options, callback): void => {
    const matching = addresses.filter(
      ({ family }) => !options.family || options.family === family,
    );
    const selected = matching.length > 0 ? matching : addresses;

    if (options.all) {
      callback(null, selected);
      return;
    }

    callback(null, selected[0].address, selected[0].family);
  };
}

export class MetadataFetchError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PageMetadataFetcher {
  constructor(private readonly extractor: PageMetadataExtractor) {}

  async fetch(url: string): Promise<ExtractedPageMetadata> {
    try {
      const document = await this.fetchDocument(new URL(url));
      return this.extractor.extract(document.body, document.resolvedUrl);
    } catch (error) {
      if (error instanceof MetadataFetchError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Fetch failed';
      throw new MetadataFetchError('network_error', true, message);
    }
  }

  private async fetchDocument(
    initialUrl: URL,
  ): Promise<{ body: Buffer; resolvedUrl: string }> {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let currentUrl = initialUrl;

    for (let redirects = 0; ; redirects += 1) {
      this.validateUrl(currentUrl);
      const addresses = await this.resolvePublicAddresses(currentUrl.hostname);
      const dispatcher = this.createPinnedDispatcher(addresses);

      try {
        const response = await fetch(currentUrl, {
          dispatcher,
          redirect: 'manual',
          signal,
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'bookmark-manager-metadata/1.0',
          },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location || redirects === MAX_REDIRECTS) {
            throw new MetadataFetchError(
              'invalid_redirect',
              false,
              'Redirect is missing a location or exceeds the redirect limit',
            );
          }

          currentUrl = new URL(location, currentUrl);
          continue;
        }

        if (!response.ok) {
          await response.body?.cancel();
          throw new MetadataFetchError(
            'http_error',
            RETRYABLE_STATUS_CODES.has(response.status) ||
              response.status >= 500,
            `Remote server returned HTTP ${response.status}`,
          );
        }

        const contentType = response.headers
          .get('content-type')
          ?.split(';', 1)[0]
          .trim()
          .toLowerCase();
        if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
          await response.body?.cancel();
          throw new MetadataFetchError(
            'unsupported_content_type',
            false,
            'Remote response is not HTML',
          );
        }

        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
          await response.body?.cancel();
          throw new MetadataFetchError(
            'body_too_large',
            false,
            'Remote response exceeds the size limit',
          );
        }

        return {
          body: await this.readLimitedBody(response.body),
          resolvedUrl: currentUrl.toString(),
        };
      } finally {
        await dispatcher.close();
      }
    }
  }

  private validateUrl(url: URL): void {
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new MetadataFetchError(
        'blocked_url',
        false,
        'Only HTTP and HTTPS URLs are supported',
      );
    }
    if (url.username || url.password) {
      throw new MetadataFetchError(
        'blocked_url',
        false,
        'URLs containing credentials are not supported',
      );
    }

    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    if (!['80', '443'].includes(port)) {
      throw new MetadataFetchError(
        'blocked_url',
        false,
        'Only standard HTTP and HTTPS ports are supported',
      );
    }
  }

  private async resolvePublicAddresses(
    hostname: string,
  ): Promise<ResolvedAddress[]> {
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
    const records = ipaddr.isValid(normalizedHostname)
      ? [
          {
            address: normalizedHostname,
            family:
              ipaddr.process(normalizedHostname).kind() === 'ipv4' ? 4 : 6,
          } as const,
        ]
      : await dns.lookup(normalizedHostname, { all: true, verbatim: true });

    if (
      records.length === 0 ||
      records.some(
        ({ address }) =>
          !ipaddr.isValid(address) ||
          ipaddr.process(address).range() !== 'unicast',
      )
    ) {
      throw new MetadataFetchError(
        'blocked_url',
        false,
        'URL resolves to a non-public address',
      );
    }

    return records.map(({ address, family }) => ({
      address,
      family: family === 6 ? 6 : 4,
    }));
  }

  private createPinnedDispatcher(addresses: ResolvedAddress[]): Agent {
    return new Agent({ connect: { lookup: createPinnedLookup(addresses) } });
  }

  private async readLimitedBody(
    body: Awaited<ReturnType<typeof fetch>>['body'],
  ): Promise<Buffer> {
    if (!body) {
      return Buffer.alloc(0);
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
      const { done, value } =
        (await reader.read()) as ReadableStreamReadResult<Uint8Array>;
      if (done) {
        return Buffer.concat(chunks, size);
      }

      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new MetadataFetchError(
          'body_too_large',
          false,
          'Remote response exceeds the size limit',
        );
      }
      chunks.push(value);
    }
  }
}
