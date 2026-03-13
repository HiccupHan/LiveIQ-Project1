import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EventStatus } from './../src/events/event-status.enum';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.DB_TYPE = 'sqljs';
    process.env.DB_SQLJS_LOCATION = ':memory:';
    process.env.DB_SYNC = 'true';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('creates, gets, deletes, and merges events for a user', async () => {
    const user1 = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Alice' })
      .expect(201);
    const user2 = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Bob' })
      .expect(201);

    const event1 = await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'E1',
        description: 'First',
        status: EventStatus.TODO,
        startTime: '2026-03-12T14:00:00.000Z',
        endTime: '2026-03-12T15:00:00.000Z',
        inviteeIds: [user1.body.id],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/events/${event1.body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(event1.body.id);
      });

    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'E2',
        description: 'Second',
        status: EventStatus.IN_PROGRESS,
        startTime: '2026-03-12T14:30:00.000Z',
        endTime: '2026-03-12T16:00:00.000Z',
        inviteeIds: [user1.body.id, user2.body.id],
      })
      .expect(201);

    const merged = await request(app.getHttpServer())
      .post(`/users/${user1.body.id}/events/merge-all`)
      .expect(201);
    
    console.log('Merged title:', merged.body[0].title);
    expect(merged.body[0].title).toContain('E1');
    expect(merged.body[0].title).toContain('E2');


    expect(merged.body).toHaveLength(1);
    expect(new Date(merged.body[0].startTime).toISOString()).toBe(
      '2026-03-12T14:00:00.000Z',
    );
    expect(new Date(merged.body[0].endTime).toISOString()).toBe(
      '2026-03-12T16:00:00.000Z',
    );
    expect(merged.body[0].invitees).toHaveLength(2);

    await request(app.getHttpServer())
      .delete(`/events/${merged.body[0].id}`)
      .expect(200)
      .expect({ deletedId: merged.body[0].id });

    await request(app.getHttpServer())
      .delete(`/users/${user2.body.id}`)
      .expect(200)
      .expect({ deletedId: user2.body.id });
  });
});
