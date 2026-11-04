import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BookmarksModule } from './bookmarks/bookmarks.module';
import { validateEnvironment } from './common/validate-environment';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    HealthModule,
    BookmarksModule,
  ],
})
export class AppModule {}
