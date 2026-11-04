import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  await app.listen(app.get(ConfigService).get<string>('PORT') ?? 3000);
}

void bootstrap();
