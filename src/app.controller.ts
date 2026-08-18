import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { AppService, HealthStatus } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth(): Promise<HealthStatus> {
    const health = await this.appService.getHealth();

    // Same body either way, but an unhealthy dependency must not look like a
    // success to load balancers, probes, or the container healthcheck.
    if (health.database !== 'up') {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
