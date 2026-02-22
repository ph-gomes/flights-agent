import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FlightSearchModule } from './modules/flight-search/flight-search.module';
import { ChatModule } from './modules/chat/chat.module';
import { PriceHistoryModule } from './modules/price-history/price-history.module';
import { AppCacheModule } from './cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const type = configService.get<string>('DATABASE_TYPE') ?? 'postgres';
        if (type === 'sqlite' || type === 'better-sqlite3') {
          const database = configService.get<string>('DATABASE_NAME');
          return {
            type: type as 'sqlite',
            database:
              (typeof database === 'string' ? database : undefined) ||
              ':memory:',
            synchronize: true,
            autoLoadEntities: true,
          };
        }
        return {
          type: 'postgres',
          host: configService.get('DATABASE_HOST'),
          port: configService.get('DATABASE_PORT'),
          username: configService.get('DATABASE_USERNAME'),
          password: configService.get('DATABASE_PASSWORD'),
          database: configService.get('DATABASE_NAME'),
          synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true',
          autoLoadEntities: true,
        };
      },
    }),
    AppCacheModule,
    FlightSearchModule,
    PriceHistoryModule,
    ChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
