import { ServiceUnavailableException } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const service = { getHealth: jest.fn() };
  const controller = new HealthController(service as unknown as HealthService);

  beforeEach(() => jest.clearAllMocks());

  it('returns an available health result', async () => {
    const health = { status: 'ok', database: 'up' } as const;
    service.getHealth.mockResolvedValue(health);

    await expect(controller.getHealth()).resolves.toBe(health);
  });

  it('throws 503 with the degraded result', async () => {
    const health = { status: 'degraded', database: 'down' } as const;
    service.getHealth.mockResolvedValue(health);

    expect.assertions(3);
    try {
      await controller.getHealth();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      expect(exception.getResponse()).toEqual(health);
    }
  });
});
