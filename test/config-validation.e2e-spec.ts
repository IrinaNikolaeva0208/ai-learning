import { Test } from '@nestjs/testing';

describe('Environment validation (e2e)', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('stops the application from starting on an invalid value', async () => {
    process.env.PORT = 'not-a-port';

    await jest.isolateModulesAsync(async () => {
      // A fresh import, because ConfigModule.forRoot runs when AppModule loads.
      const { AppModule } = await import('../src/app.module');

      await expect(
        Test.createTestingModule({ imports: [AppModule] }).compile(),
      ).rejects.toThrow('PORT must be an integer between 1 and 65535');
    });
  });
});
