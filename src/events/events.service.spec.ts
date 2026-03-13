import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../users/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { EventStatus } from './event-status.enum';
import { EventEntity } from './event.entity';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let mockEventsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let mockUsersRepository: {
    findBy: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };

  const makeQueryBuilder = (eventIds: number[]) => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest
      .fn()
      .mockResolvedValue(eventIds.map((id) => ({ id: String(id) }))),
  });

  beforeEach(async () => {
    mockEventsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: { transaction: jest.fn() },
    };

    mockUsersRepository = {
      findBy: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(EventEntity),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  it('creates an event and resolves invitees', async () => {
    const dto: CreateEventDto = {
      title: 'Interview Prep',
      status: EventStatus.TODO,
      startTime: '2026-03-12T14:00:00.000Z',
      endTime: '2026-03-12T15:00:00.000Z',
      inviteeIds: [1, 2],
    };

    const invitees = [
      { id: 1, name: 'Alice' } as UserEntity,
      { id: 2, name: 'Bob' } as UserEntity,
    ];

    const created = {
      id: 11,
      ...dto,
      description: null,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      invitees,
    } as unknown as EventEntity;

    mockUsersRepository.findBy.mockResolvedValue(invitees);
    mockEventsRepository.create.mockReturnValue(created);
    mockEventsRepository.save.mockResolvedValue(created);
    mockUsersRepository.find.mockResolvedValue(
      invitees.map((invitee) => ({ ...invitee, invitedEvents: [created] })),
    );
    mockUsersRepository.save.mockResolvedValue(invitees);
    mockEventsRepository.findOne.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(mockUsersRepository.findBy).toHaveBeenCalledWith({
      id: expect.any(Object),
    });
    expect(mockEventsRepository.create).toHaveBeenCalled();
    expect(mockEventsRepository.save).toHaveBeenCalledWith(created);
    expect(result.id).toBe(11);
  });

  it('creates an event without invitees', async () => {
    const dto: CreateEventDto = {
      title: 'Solo',
      status: EventStatus.TODO,
      startTime: '2026-03-12T08:00:00.000Z',
      endTime: '2026-03-12T09:00:00.000Z',
    };

    const created = {
      id: 20,
      ...dto,
      description: null,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      invitees: [],
    } as unknown as EventEntity;

    mockEventsRepository.create.mockReturnValue(created);
    mockEventsRepository.save.mockResolvedValue(created);
    mockEventsRepository.findOne.mockResolvedValue(created);

    await expect(service.create(dto)).resolves.toEqual(created);
    expect(mockUsersRepository.findBy).not.toHaveBeenCalled();
    expect(mockUsersRepository.find).not.toHaveBeenCalled();
    expect(mockUsersRepository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid event time format', async () => {
    const dto: CreateEventDto = {
      title: 'Invalid',
      status: EventStatus.TODO,
      startTime: 'not-a-date',
      endTime: '2026-03-12T09:00:00.000Z',
    };

    await expect(service.create(dto)).rejects.toThrow(
      'startTime and endTime must be valid ISO dates',
    );
  });

  it('rejects endTime before startTime', async () => {
    const dto: CreateEventDto = {
      title: 'Invalid',
      status: EventStatus.TODO,
      startTime: '2026-03-12T10:00:00.000Z',
      endTime: '2026-03-12T09:00:00.000Z',
    };

    await expect(service.create(dto)).rejects.toThrow(
      'endTime must be after startTime',
    );
  });

  it('rejects create when invitees are missing', async () => {
    const dto: CreateEventDto = {
      title: 'Invitees',
      status: EventStatus.TODO,
      startTime: '2026-03-12T08:00:00.000Z',
      endTime: '2026-03-12T09:00:00.000Z',
      inviteeIds: [1, 2],
    };

    mockUsersRepository.findBy.mockResolvedValue([{ id: 1 }]);

    await expect(service.create(dto)).rejects.toThrow(
      'One or more invitees were not found',
    );
  });

  it('throws when event does not exist', async () => {
    mockEventsRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow('Event 999 not found');
  });

  it('throws when merge target user does not exist', async () => {
    mockUsersRepository.findOne.mockResolvedValue(null);

    await expect(service.mergeAllForUser(42)).rejects.toThrow(
      'User 42 not found',
    );
  });

  it('returns empty list when merge target has no events', async () => {
    const user = { id: 1, name: 'Alice', events: [] } as UserEntity;
    mockUsersRepository.findOne.mockResolvedValue(user);
    mockEventsRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder([]));

    await expect(service.mergeAllForUser(1)).resolves.toEqual([]);
    expect(mockEventsRepository.find).not.toHaveBeenCalled();
    expect(mockEventsRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('deletes an event by id', async () => {
    const event = {
      id: 25,
      invitees: [],
    } as unknown as EventEntity;

    mockEventsRepository.findOne.mockResolvedValue(event);
    mockEventsRepository.remove.mockResolvedValue(event);

    const result = await service.remove(25);

    expect(mockEventsRepository.remove).toHaveBeenCalledWith(event);
    expect(result).toEqual({ deletedId: 25 });
  });

  it('returns original events when no overlaps exist', async () => {
    const user = { id: 1, name: 'Alice', events: [] } as UserEntity;
    const events = [
      {
        id: 1,
        title: 'E1',
        status: EventStatus.TODO,
        startTime: new Date('2026-03-12T10:00:00.000Z'),
        endTime: new Date('2026-03-12T11:00:00.000Z'),
        invitees: [user],
      },
      {
        id: 2,
        title: 'E2',
        status: EventStatus.TODO,
        startTime: new Date('2026-03-12T11:15:00.000Z'),
        endTime: new Date('2026-03-12T12:00:00.000Z'),
        invitees: [user],
      },
    ] as EventEntity[];

    mockUsersRepository.findOne.mockResolvedValue(user);
    mockEventsRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder([1, 2]));
    mockEventsRepository.find.mockResolvedValue(events);

    const result = await service.mergeAllForUser(1);

    expect(result).toEqual(events);
    expect(mockEventsRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('merges overlapping events and runs transaction', async () => {
    const alice = { id: 1, name: 'Alice', events: [] } as UserEntity;
    const bob = { id: 2, name: 'Bob', events: [] } as UserEntity;

    const events = [
      {
        id: 1,
        title: 'E1',
        description: 'A',
        status: EventStatus.TODO,
        startTime: new Date('2026-03-12T14:00:00.000Z'),
        endTime: new Date('2026-03-12T15:00:00.000Z'),
        invitees: [alice],
      },
      {
        id: 2,
        title: 'E2',
        description: 'B',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2026-03-12T14:30:00.000Z'),
        endTime: new Date('2026-03-12T16:00:00.000Z'),
        invitees: [alice, bob],
      },
    ] as EventEntity[];

    const mergedResult = [
      {
        id: 100,
        title: 'E1 | E2',
        description: 'A | B',
        status: EventStatus.IN_PROGRESS,
        startTime: new Date('2026-03-12T14:00:00.000Z'),
        endTime: new Date('2026-03-12T16:00:00.000Z'),
        invitees: [alice, bob],
      },
    ] as EventEntity[];

    mockUsersRepository.findOne.mockResolvedValue(alice);
    mockEventsRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder([1, 2]));
    mockEventsRepository.find.mockResolvedValue(events);

    mockEventsRepository.manager.transaction.mockImplementation(async (work) => {
      const txEventRepo = {
        remove: jest.fn().mockResolvedValue(events),
        create: jest.fn((input: EventEntity) => input),
        save: jest.fn().mockResolvedValue(mergedResult),
        find: jest.fn().mockResolvedValue(mergedResult),
      };
      const txUserRepo = {
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockResolvedValue([]),
      };

      return work({
        getRepository: (entity: unknown) => {
          if (entity === EventEntity) {
            return txEventRepo;
          }
          return txUserRepo;
        },
      });
    });

    const result = await service.mergeAllForUser(1);

    expect(mockEventsRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mergedResult);
  });

  it('merges TODO + COMPLETED into IN_PROGRESS', async () => {
    const alice = { id: 1, name: 'Alice', events: [] } as UserEntity;
    const events = [
      {
        id: 1,
        title: 'Planning',
        description: null,
        status: EventStatus.TODO,
        startTime: new Date('2026-03-12T14:00:00.000Z'),
        endTime: new Date('2026-03-12T15:00:00.000Z'),
        invitees: [alice],
      },
      {
        id: 2,
        title: 'Done',
        description: null,
        status: EventStatus.COMPLETED,
        startTime: new Date('2026-03-12T14:30:00.000Z'),
        endTime: new Date('2026-03-12T16:00:00.000Z'),
        invitees: [alice],
      },
    ] as EventEntity[];

    mockUsersRepository.findOne.mockResolvedValue(alice);
    mockEventsRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder([1, 2]));
    mockEventsRepository.find.mockResolvedValue(events);

    mockEventsRepository.manager.transaction.mockImplementation(async (work) => {
      const txEventRepo = {
        remove: jest.fn().mockResolvedValue(events),
        create: jest.fn((input: EventEntity) => ({ id: 700, ...input })),
        save: jest.fn().mockImplementation(async (input: EventEntity[]) => input),
        find: jest.fn().mockResolvedValue([
          {
            id: 700,
            status: EventStatus.IN_PROGRESS,
            invitees: [alice],
            startTime: new Date('2026-03-12T14:00:00.000Z'),
            endTime: new Date('2026-03-12T16:00:00.000Z'),
          },
        ]),
      };
      const txUserRepo = {
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockResolvedValue([]),
      };

      return work({
        getRepository: (entity: unknown) => {
          if (entity === EventEntity) {
            return txEventRepo;
          }
          return txUserRepo;
        },
      });
    });

    const result = await service.mergeAllForUser(1);
    expect(result[0].status).toBe(EventStatus.IN_PROGRESS);
  });
});
