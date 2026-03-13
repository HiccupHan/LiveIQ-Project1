import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const user = this.usersRepository.create({ name: dto.name, events: [] });
    return this.usersRepository.save(user);
  }

  async findOne(id: number): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { invitedEvents: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async remove(id: number): Promise<{ deletedId: number }> {
    const user = await this.findOne(id);
    // Break many-to-many links before deleting the user row.
    user.invitedEvents = [];
    await this.usersRepository.save(user);
    await this.usersRepository.remove(user);

    return { deletedId: id };
  }
}
