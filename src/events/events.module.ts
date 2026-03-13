import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventEntity } from './event.entity';
import { UserEntity } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, UserEntity])],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
