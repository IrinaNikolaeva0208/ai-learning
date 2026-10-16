import 'reflect-metadata';

import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBookmarkDto } from './create-bookmark.dto';
import { ListBookmarksQueryDto } from './list-bookmarks-query.dto';
import { UpdateBookmarkDto } from './update-bookmark.dto';

describe('Bookmark DTOs', () => {
  const transformAndValidate = async <T extends object>(
    type: ClassConstructor<T>,
    input: object,
  ): Promise<{ instance: T; properties: string[] }> => {
    const instance = plainToInstance(type, input);
    const errors = await validate(instance);
    return { instance, properties: errors.map(({ property }) => property) };
  };

  describe('CreateBookmarkDto', () => {
    it('normalizes and accepts valid values', async () => {
      const { instance, properties } = await transformAndValidate(
        CreateBookmarkDto,
        {
          title: '  NestJS  ',
          url: '  http://localhost:3000/docs  ',
          description: '  Documentation  ',
        },
      );

      expect(properties).toEqual([]);
      expect(instance).toMatchObject({
        title: 'NestJS',
        url: 'http://localhost:3000/docs',
        description: 'Documentation',
      });
    });

    it.each([
      [{ title: '', url: 'https://example.com' }, 'title'],
      [{ title: 'x'.repeat(201), url: 'https://example.com' }, 'title'],
      [{ title: 'Valid', url: 'ftp://example.com' }, 'url'],
      [
        { title: 'Valid', url: `https://example.com/${'x'.repeat(2030)}` },
        'url',
      ],
      [
        {
          title: 'Valid',
          url: 'https://example.com',
          description: 'x'.repeat(1001),
        },
        'description',
      ],
    ])('rejects invalid input %#', async (input, property) => {
      const result = await transformAndValidate(CreateBookmarkDto, input);
      expect(result.properties).toContain(property);
    });

    it.each([{}, { description: null }, { description: '   ' }])(
      'handles optional description variant %#',
      async (description) => {
        const result = await transformAndValidate(CreateBookmarkDto, {
          title: 'Valid',
          url: 'https://example.com',
          ...description,
        });
        expect(result.properties).toEqual([]);
      },
    );
  });

  describe('UpdateBookmarkDto', () => {
    it('accepts an empty object and optional valid fields', async () => {
      await expect(
        transformAndValidate(UpdateBookmarkDto, {}),
      ).resolves.toMatchObject({ properties: [] });

      const result = await transformAndValidate(UpdateBookmarkDto, {
        title: '  Updated  ',
        url: '  https://example.com/updated  ',
        description: '  Updated description  ',
      });
      expect(result.properties).toEqual([]);
      expect(result.instance).toMatchObject({
        title: 'Updated',
        url: 'https://example.com/updated',
        description: 'Updated description',
      });
    });

    it('rejects null title and URL but accepts null description', async () => {
      const result = await transformAndValidate(UpdateBookmarkDto, {
        title: null,
        url: null,
        description: null,
      });

      expect(result.properties).toEqual(
        expect.arrayContaining(['title', 'url']),
      );
      expect(result.properties).not.toContain('description');
    });

    it('normalizes an empty description to null', async () => {
      const result = await transformAndValidate(UpdateBookmarkDto, {
        description: '   ',
      });

      expect(result.properties).toEqual([]);
      expect(result.instance.description).toBeNull();
    });
  });

  describe('ListBookmarksQueryDto', () => {
    it('provides defaults', async () => {
      const result = await transformAndValidate(ListBookmarksQueryDto, {});

      expect(result.properties).toEqual([]);
      expect(result.instance).toMatchObject({ page: 1, limit: 20 });
    });

    it('transforms valid query strings to numbers', async () => {
      const result = await transformAndValidate(ListBookmarksQueryDto, {
        page: '2',
        limit: '100',
        search: '  NestJS guide  ',
      });

      expect(result.properties).toEqual([]);
      expect(result.instance).toMatchObject({
        page: 2,
        limit: 100,
        search: 'NestJS guide',
      });
    });

    it.each(['x', 'x'.repeat(200)])(
      'accepts a search value at a valid length boundary',
      async (search) => {
        const result = await transformAndValidate(ListBookmarksQueryDto, {
          search,
        });

        expect(result.properties).toEqual([]);
        expect(result.instance.search).toBe(search);
      },
    );

    it.each([
      [{ page: '0' }, 'page'],
      [{ page: '1.5' }, 'page'],
      [{ limit: '0' }, 'limit'],
      [{ limit: '101' }, 'limit'],
    ])('rejects invalid pagination %#', async (input, property) => {
      const result = await transformAndValidate(ListBookmarksQueryDto, input);
      expect(result.properties).toContain(property);
    });

    it.each(['   ', 'x'.repeat(201), 42, ['one', 'two']])(
      'rejects invalid search value %#',
      async (search) => {
        const result = await transformAndValidate(ListBookmarksQueryDto, {
          search,
        });

        expect(result.properties).toContain('search');
      },
    );
  });
});
