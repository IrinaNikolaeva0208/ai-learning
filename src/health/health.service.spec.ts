import { HealthMapperService } from './health-mapper.service';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const repository = { checkDatabase: jest.fn() };
  const mapper = new HealthMapperService();
  const service = new HealthService(
    repository as unknown as HealthRepository,
    mapper,
  );

  beforeEach(() => jest.clearAllMocks());

  it('maps a successful database check', async () => {
    repository.checkDatabase.mockResolvedValue(undefined);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('maps a failed database check', async () => {
    repository.checkDatabase.mockRejectedValue(new Error('offline'));

    await expect(service.getHealth()).resolves.toEqual({
      status: 'degraded',
      database: 'down',
    });
  });
});
