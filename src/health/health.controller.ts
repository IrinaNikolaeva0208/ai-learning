import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { HealthStatus } from './health-status.interface';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth(): Promise<HealthStatus> {
    const health = await this.healthService.getHealth();

    if (health.database !== 'up') {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
