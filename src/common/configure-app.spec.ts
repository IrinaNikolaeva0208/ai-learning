import { INestApplication, ValidationPipe } from '@nestjs/common';

import { configureApp } from './configure-app';

describe('configureApp', () => {
  let useGlobalPipes: jest.Mock;
  let enableShutdownHooks: jest.Mock;

  beforeEach(() => {
    useGlobalPipes = jest.fn();
    enableShutdownHooks = jest.fn();

    configureApp({
      useGlobalPipes,
      enableShutdownHooks,
    } as unknown as INestApplication);
  });

  it('registers the global validation pipe', () => {
    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
  });

  it('enables shutdown hooks so signals run graceful cleanup', () => {
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  });
});
