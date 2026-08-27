import { Transform } from 'class-transformer';
import {
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { trimNullableString } from '../helpers/trim-nullable-string.helper';
import { trimString } from '../helpers/trim-string.helper';

export class CreateBookmarkDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  url!: string;

  @Transform(trimNullableString)
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
