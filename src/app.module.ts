import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookmarkMetadataModule } from './bookmark-metadata/bookmark-metadata.module';
import { PrismaModule } from './prisma/prisma.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BookmarksModule,
    BookmarkMetadataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
