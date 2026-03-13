import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('creates a user with empty events', async () => {
    const dto = { name: 'Alice' };
    const created = { id: 1, name: 'Alice', events: [] };
    repository.create.mockReturnValue(created);
    repository.save.mockResolvedValue(created);

    await expect(service.create(dto)).resolves.toEqual(created);
    expect(repository.create).toHaveBeenCalledWith({ name: 'Alice', events: [] });
    expect(repository.save).toHaveBeenCalledWith(created);
  });

  it('returns user by id', async () => {
    const user = { id: 5, name: 'Bob', invitedEvents: [] };
    repository.findOne.mockResolvedValue(user);

    await expect(service.findOne(5)).resolves.toEqual(user);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: { invitedEvents: true },
    });
  });

  it('throws not found when user does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(9)).rejects.toThrow(NotFoundException);
  });

  it('removes user and clears invitedEvents relation', async () => {
    const user = {
      id: 3,
      name: 'Carol',
      invitedEvents: [{ id: 100 }],
      events: ['100'],
    };
    repository.findOne.mockResolvedValue(user);
    repository.save.mockResolvedValue({ ...user, invitedEvents: [] });
    repository.remove.mockResolvedValue(user);

    await expect(service.remove(3)).resolves.toEqual({ deletedId: 3 });
    expect(repository.save).toHaveBeenCalledWith({ ...user, invitedEvents: [] });
    expect(repository.remove).toHaveBeenCalled();
  });
});
