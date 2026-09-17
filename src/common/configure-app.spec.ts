import { INestApplication, ValidationPipe } from '@nestjs/common';

import { configureApp } from './configure-app';

describe('configureApp', () => {
  it('registers the global validation pipe', () => {
    const useGlobalPipes = jest.fn();
    const app = { useGlobalPipes } as unknown as INestApplication;

    configureApp(app);

    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
  });
});
