import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventStatus } from './event-status.enum';

describe('EventsController', () => {
  let controller: EventsController;
  let service: {
    create: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create', async () => {
    const dto = {
      title: 'Demo',
      status: EventStatus.TODO,
      startTime: '2026-03-12T10:00:00.000Z',
      endTime: '2026-03-12T11:00:00.000Z',
    };
    const created = { id: 1, ...dto };
    service.create.mockResolvedValue(created);

    await expect(controller.create(dto)).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findOne', async () => {
    service.findOne.mockResolvedValue({ id: 7 });

    await expect(controller.findOne(7)).resolves.toEqual({ id: 7 });
    expect(service.findOne).toHaveBeenCalledWith(7);
  });

  it('delegates remove', async () => {
    service.remove.mockResolvedValue({ deletedId: 3 });

    await expect(controller.remove(3)).resolves.toEqual({ deletedId: 3 });
    expect(service.remove).toHaveBeenCalledWith(3);
  });
});
