import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BookmarksModule } from './bookmarks/bookmarks.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    BookmarksModule,
  ],
})
export class AppModule {}
