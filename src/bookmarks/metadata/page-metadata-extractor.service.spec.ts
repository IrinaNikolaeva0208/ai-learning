import { PageMetadataExtractorService } from './page-metadata-extractor.service';

describe('PageMetadataExtractorService', () => {
  const extractor = new PageMetadataExtractorService();

  it('extracts and normalizes core preview metadata', () => {
    const html = Buffer.from(`
      <html>
        <head>
          <title>  Example\n page  </title>
          <meta name="DESCRIPTION" content="  A useful   page ">
          <meta property="og:title" content=" Social title ">
          <meta property="og:description" content=" Social description ">
          <meta property="og:image" content="/preview.png">
        </head>
      </html>
    `);

    expect(extractor.extract(html, 'https://example.com/articles/1')).toEqual({
      pageTitle: 'Example page',
      description: 'A useful page',
      openGraphTitle: 'Social title',
      openGraphDescription: 'Social description',
      openGraphImageUrl: 'https://example.com/preview.png',
      resolvedUrl: 'https://example.com/articles/1',
    });
  });

  it('returns null for missing, empty, invalid, or non-HTTP metadata', () => {
    expect(
      extractor.extract(
        Buffer.from(`
          <title> </title>
          <meta property="og:image" content="javascript:alert(1)">
        `),
        'https://example.com',
      ),
    ).toEqual({
      pageTitle: null,
      description: null,
      openGraphTitle: null,
      openGraphDescription: null,
      openGraphImageUrl: null,
      resolvedUrl: 'https://example.com',
    });

    expect(
      extractor.extract(
        Buffer.from('<meta property="og:image" content="http://[invalid">'),
        'https://example.com',
      ).openGraphImageUrl,
    ).toBeNull();
  });

  it('removes credentials and caps extracted field lengths', () => {
    const metadata = extractor.extract(
      Buffer.from(`
        <title>${'t'.repeat(510)}</title>
        <meta name="description" content="${'d'.repeat(2010)}">
        <meta property="og:image" content="https://user:pass@example.com/image">
      `),
      'https://example.com',
    );

    expect(metadata.pageTitle).toHaveLength(500);
    expect(metadata.description).toHaveLength(2_000);
    expect(metadata.openGraphImageUrl).toBe('https://example.com/image');
  });
});
