import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthMapperService } from './health.mapper.service';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthRepository, HealthMapperService],
})
export class HealthModule {}
