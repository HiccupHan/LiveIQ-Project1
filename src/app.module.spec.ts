import { ConfigService } from '@nestjs/config';
import initSqlJs from 'sql.js';
import { buildTypeOrmOptions } from './app.module';

jest.mock('sql.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('buildTypeOrmOptions', () => {
  const makeConfig = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string, defaultValue?: string) =>
        key in values ? values[key] : defaultValue,
      ),
    }) as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds postgres options with defaults', async () => {
    const config = makeConfig({});

    const options = await buildTypeOrmOptions(config);

    expect(options).toMatchObject({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'liveiq',
      autoLoadEntities: true,
      synchronize: true,
    });
  });

  it('builds mysql options and respects DB_SYNC=false', async () => {
    const config = makeConfig({
      DB_TYPE: 'mysql',
      DB_HOST: 'db.local',
      DB_PORT: '3307',
      DB_USER: 'root',
      DB_PASS: 'secret',
      DB_NAME: 'interview',
      DB_SYNC: 'false',
    });

    const options = await buildTypeOrmOptions(config);

    expect(options).toMatchObject({
      type: 'mysql',
      host: 'db.local',
      port: 3307,
      username: 'root',
      password: 'secret',
      database: 'interview',
      synchronize: false,
    });
  });

  it('builds sqljs options and loads sql.js driver', async () => {
    const sqlJsDriver = { Database: jest.fn() };
    (initSqlJs as jest.Mock).mockResolvedValue(sqlJsDriver);
    const config = makeConfig({
      DB_TYPE: 'sqljs',
      DB_SQLJS_LOCATION: ':memory:',
    });

    const options = await buildTypeOrmOptions(config);

    expect(initSqlJs).toHaveBeenCalledWith({});
    expect(options).toMatchObject({
      type: 'sqljs',
      driver: sqlJsDriver,
      autoSave: false,
      location: ':memory:',
      autoLoadEntities: true,
      synchronize: true,
      dropSchema: true,
    });
  });
});
