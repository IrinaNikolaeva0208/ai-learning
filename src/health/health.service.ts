import { Injectable } from '@nestjs/common';

import { HealthMapperService } from './health-mapper.service';
import { HealthStatus } from './health-status.interface';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(
    private readonly repository: HealthRepository,
    private readonly mapper: HealthMapperService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    try {
      await this.repository.checkDatabase();
      return this.mapper.toHealthStatus(true);
    } catch {
      return this.mapper.toHealthStatus(false);
    }
  }
}
