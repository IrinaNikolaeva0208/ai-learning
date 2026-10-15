import { Injectable } from '@nestjs/common';

import { HealthStatus } from './health-status.interface';

@Injectable()
export class HealthMapperService {
  toHealthStatus(databaseUp: boolean): HealthStatus {
    return databaseUp
      ? { status: 'ok', database: 'up' }
      : { status: 'degraded', database: 'down' };
  }
}
