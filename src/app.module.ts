import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { EventsModule } from './events/events.module';
import { UsersModule } from './users/users.module';

export async function buildTypeOrmOptions(
  config: ConfigService,
): Promise<TypeOrmModuleOptions> {
  const type = config.get<'postgres' | 'mysql' | 'sqljs'>('DB_TYPE', 'postgres');

  // sqljs is used for fast, self-contained test runs.
  if (type === 'sqljs') {
    const initSqlJs = (await import('sql.js')).default;
    const sqlJsDriver = await initSqlJs({});

    return {
      type: 'sqljs',
      driver: sqlJsDriver,
      autoSave: false,
      location: config.get<string>('DB_SQLJS_LOCATION', ':memory:'),
      autoLoadEntities: true,
      synchronize: true,
      dropSchema: true,
    };
  }

  // Real DB config for local/prod-like runtime.
  const defaultPort = type === 'mysql' ? 3306 : 5432;
  return {
    type,
    host: config.get<string>('DB_HOST', '127.0.0.1'),
    port: Number(config.get<string>('DB_PORT', `${defaultPort}`)),
    username: config.get<string>('DB_USER', 'postgres'),
    password: config.get<string>('DB_PASS', 'postgres'),
    database: config.get<string>('DB_NAME', 'liveiq'),
    autoLoadEntities: true,
    synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    EventsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
