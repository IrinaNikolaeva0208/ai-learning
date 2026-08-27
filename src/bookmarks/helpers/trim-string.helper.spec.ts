import { TransformFnParams } from 'class-transformer';

import { trimString } from './trim-string.helper';

describe('trimString', () => {
  const transform = (value: unknown): unknown =>
    trimString({ value } as TransformFnParams);

  it('trims strings', () => {
    expect(transform('  value  ')).toBe('value');
  });

  it('returns non-string values unchanged', () => {
    expect(transform(null)).toBeNull();
    expect(transform(42)).toBe(42);
  });
});
