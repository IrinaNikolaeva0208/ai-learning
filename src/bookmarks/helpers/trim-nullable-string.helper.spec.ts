import { TransformFnParams } from 'class-transformer';

import { trimNullableString } from './trim-nullable-string.helper';

describe('trimNullableString', () => {
  const transform = (value: unknown): unknown =>
    trimNullableString({ value } as TransformFnParams);

  it('trims non-empty strings', () => {
    expect(transform('  value  ')).toBe('value');
  });

  it('converts empty trimmed strings to null', () => {
    expect(transform('   ')).toBeNull();
  });

  it('returns non-string values unchanged', () => {
    expect(transform(null)).toBeNull();
    expect(transform(42)).toBe(42);
  });
});
