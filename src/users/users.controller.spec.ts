import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '../events/events.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    create: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let eventsService: {
    mergeAllForUser: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    eventsService = {
      mergeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('delegates create', async () => {
    const dto = { name: 'Alice' };
    usersService.create.mockResolvedValue({ id: 1, ...dto });

    await expect(controller.create(dto)).resolves.toEqual({ id: 1, ...dto });
    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates findOne', async () => {
    usersService.findOne.mockResolvedValue({ id: 2 });

    await expect(controller.findOne(2)).resolves.toEqual({ id: 2 });
    expect(usersService.findOne).toHaveBeenCalledWith(2);
  });

  it('delegates remove', async () => {
    usersService.remove.mockResolvedValue({ deletedId: 2 });

    await expect(controller.remove(2)).resolves.toEqual({ deletedId: 2 });
    expect(usersService.remove).toHaveBeenCalledWith(2);
  });

  it('delegates mergeAll', async () => {
    eventsService.mergeAllForUser.mockResolvedValue([{ id: 10 }]);

    await expect(controller.mergeAll(1)).resolves.toEqual([{ id: 10 }]);
    expect(eventsService.mergeAllForUser).toHaveBeenCalledWith(1);
  });
});
