import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { BookmarksService } from './bookmarks.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { ListBookmarksQueryDto } from './dto/list-bookmarks-query.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import { Bookmark, BookmarkPage } from './types/bookmark.types';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  create(@Body() data: CreateBookmarkDto): Promise<Bookmark> {
    return this.bookmarksService.create(data);
  }

  @Get()
  findAll(@Query() query: ListBookmarksQueryDto): Promise<BookmarkPage> {
    return this.bookmarksService.findAll(query.page, query.limit);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Bookmark> {
    return this.bookmarksService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() data: UpdateBookmarkDto,
  ): Promise<Bookmark> {
    return this.bookmarksService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.bookmarksService.delete(id);
  }
}
