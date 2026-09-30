import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

import { ExtractedPageMetadata } from './bookmark-metadata.types';

const TITLE_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 2_000;
const URL_MAX_LENGTH = 2_048;

@Injectable()
export class PageMetadataExtractor {
  extract(html: Buffer, resolvedUrl: string): ExtractedPageMetadata {
    const $ = cheerio.loadBuffer(html);

    return {
      pageTitle: this.normalize($('title').first().text(), TITLE_MAX_LENGTH),
      description: this.normalize(
        this.metaContent($, 'name', 'description'),
        DESCRIPTION_MAX_LENGTH,
      ),
      openGraphTitle: this.normalize(
        this.metaContent($, 'property', 'og:title'),
        TITLE_MAX_LENGTH,
      ),
      openGraphDescription: this.normalize(
        this.metaContent($, 'property', 'og:description'),
        DESCRIPTION_MAX_LENGTH,
      ),
      openGraphImageUrl: this.resolveImageUrl(
        this.metaContent($, 'property', 'og:image'),
        resolvedUrl,
      ),
      resolvedUrl,
    };
  }

  private metaContent(
    $: cheerio.CheerioAPI,
    attribute: 'name' | 'property',
    expectedValue: string,
  ): string | undefined {
    const element = $('meta')
      .filter(
        (_index, candidate) =>
          ($(candidate).attr(attribute) ?? '').toLowerCase() === expectedValue,
      )
      .first();

    return element.attr('content');
  }

  private normalize(
    value: string | undefined,
    maxLength: number,
  ): string | null {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
  }

  private resolveImageUrl(
    value: string | undefined,
    resolvedUrl: string,
  ): string | null {
    const normalized = this.normalize(value, URL_MAX_LENGTH);
    if (!normalized) {
      return null;
    }

    try {
      const imageUrl = new URL(normalized, resolvedUrl);
      if (!['http:', 'https:'].includes(imageUrl.protocol)) {
        return null;
      }

      imageUrl.username = '';
      imageUrl.password = '';
      return imageUrl.toString().slice(0, URL_MAX_LENGTH);
    } catch {
      return null;
    }
  }
}
