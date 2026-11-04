import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPort,
  IsString,
  Matches,
  validateSync,
} from 'class-validator';

const PORT_MESSAGE = 'PORT must be an integer between 1 and 65535';

class EnvironmentVariables {
  @IsString({ message: 'DATABASE_URL is required' })
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  // IsPort alone also accepts 0 and a leading sign.
  @IsOptional()
  @Matches(/^[1-9]\d*$/, { message: PORT_MESSAGE })
  @IsPort({ message: PORT_MESSAGE })
  PORT?: string;

  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'METADATA_WORKER_ENABLED must be true or false',
  })
  METADATA_WORKER_ENABLED?: string;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors = validateSync(plainToInstance(EnvironmentVariables, config), {
    stopAtFirstError: true,
  });

  if (errors.length > 0) {
    // Messages are fixed text: the rejected values may be secrets.
    const messages = errors.flatMap(({ constraints }) =>
      Object.values({ ...constraints }),
    );
    throw new Error(`Invalid environment: ${messages.join('; ')}`);
  }

  return config;
}
