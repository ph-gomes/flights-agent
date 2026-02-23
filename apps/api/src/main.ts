import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const;

function toLogLevels(level: string): (typeof LOG_LEVELS)[number][] {
  const normalized = level.toLowerCase();
  const index = LOG_LEVELS.indexOf(normalized as (typeof LOG_LEVELS)[number]);
  if (index === -1) return ['error', 'warn', 'log'];
  return LOG_LEVELS.slice(0, index + 1);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logLevel = configService.get<string>('LOG_LEVEL') ?? 'log';
  app.useLogger(toLogLevels(logLevel));
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();
