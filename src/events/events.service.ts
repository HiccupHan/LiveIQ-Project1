import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { EventStatus } from './event-status.enum';
import { EventEntity } from './event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventsRepository: Repository<EventEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(dto: CreateEventDto): Promise<EventEntity> {
    const { start, end } = this.parseAndValidateRange(dto.startTime, dto.endTime);
    const invitees = await this.resolveInvitees(dto.inviteeIds ?? []);

    const event = this.eventsRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      startTime: start,
      endTime: end,
      invitees,
    });

    const savedEvent = await this.eventsRepository.save(event);
    await this.syncUsersEventStrings(invitees.map((invitee) => invitee.id));

    return this.findOne(savedEvent.id);
  }

  async findOne(id: number): Promise<EventEntity> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: { invitees: true },
    });

    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    return event;
  }

  async remove(id: number): Promise<{ deletedId: number }> {
    const event = await this.findOne(id);
    await this.eventsRepository.remove(event);
    await this.syncUsersEventStrings(event.invitees.map((invitee) => invitee.id));

    return { deletedId: id };
  }

  async mergeAllForUser(userId: number): Promise<EventEntity[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // First select matching event ids, then fetch full entities to keep all invitees.
    const scopedEvents = await this.eventsRepository
      .createQueryBuilder('event')
      .leftJoin('event.invitees', 'invitee')
      .select('event.id', 'id')
      .where('invitee.id = :userId', { userId })
      .getRawMany<{ id: number }>();

    const eventIds = scopedEvents.map((item) => Number(item.id));
    if (eventIds.length === 0) {
      return [];
    }

    const events = await this.eventsRepository.find({
      where: { id: In(eventIds) },
      relations: { invitees: true },
      order: { startTime: 'ASC', id: 'ASC' },
    });

    const mergedDrafts = this.buildMergedDrafts(events);

    // No overlaps detected; return current state unchanged.
    if (mergedDrafts.length === events.length) {
      return events;
    }

    const originalInviteeIds = new Set(
      events.flatMap((event) => event.invitees.map((invitee) => invitee.id)),
    );

    // Rewrite old events + user denormalized event ids in one transaction.
    return this.eventsRepository.manager.transaction(async (manager) => {
      const txEventRepository = manager.getRepository(EventEntity);
      const savedMergedEvents = await this.rewriteEvents(
        events,
        mergedDrafts,
        txEventRepository,
      );

      const affectedInviteeIds = new Set<number>(originalInviteeIds);
      for (const mergedEvent of savedMergedEvents) {
        for (const invitee of mergedEvent.invitees) {
          affectedInviteeIds.add(invitee.id);
        }
      }

      await this.syncUsersEventStrings([...affectedInviteeIds], manager);

      return txEventRepository.find({
        where: { id: In(savedMergedEvents.map((event) => event.id)) },
        relations: { invitees: true },
        order: { startTime: 'ASC', id: 'ASC' },
      });
    });
  }

  private parseAndValidateRange(
    startTime: string,
    endTime: string,
  ): { start: Date; end: Date } {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('startTime and endTime must be valid ISO dates');
    }

    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    return { start, end };
  }

  private async resolveInvitees(inviteeIds: number[]): Promise<UserEntity[]> {
    const uniqueIds = [...new Set(inviteeIds)];
    if (uniqueIds.length === 0) {
      return [];
    }

    const invitees = await this.usersRepository.findBy({ id: In(uniqueIds) });
    if (invitees.length !== uniqueIds.length) {
      throw new NotFoundException('One or more invitees were not found');
    }

    return invitees;
  }

  private buildMergedDrafts(events: EventEntity[]): MergedDraft[] {
    const sortedEvents = [...events].sort((a, b) => {
      const byStart = a.startTime.getTime() - b.startTime.getTime();
      if (byStart !== 0) {
        return byStart;
      }
      return a.id - b.id;
    });

    const drafts: MergedDraft[] = [];

    // Sweep-line merge over start-time sorted events.
    for (const event of sortedEvents) {
      const current = drafts[drafts.length - 1];
      if (!current) {
        drafts.push(this.createDraft(event));
        continue;
      }

      if (event.startTime <= current.endTime) {
        this.mergeIntoDraft(current, event);
      } else {
        drafts.push(this.createDraft(event));
      }
    }

    return drafts;
  }

  private createDraft(event: EventEntity): MergedDraft {
    return {
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      titles: new Set([event.title]),
      descriptions: new Set(
        event.description ? [event.description] : ([] as string[]),
      ),
      statuses: [event.status],
      invitees: new Map(event.invitees.map((invitee) => [invitee.id, invitee])),
    };
  }

  private mergeIntoDraft(draft: MergedDraft, event: EventEntity): void {
    if (event.endTime > draft.endTime) {
      draft.endTime = new Date(event.endTime);
    }

    draft.titles.add(event.title);
    if (event.description) {
      draft.descriptions.add(event.description);
    }
    draft.statuses.push(event.status);

    for (const invitee of event.invitees) {
      draft.invitees.set(invitee.id, invitee);
    }
  }

  private pickMergedStatus(statuses: EventStatus[]): EventStatus {
    // Precedence: IN_PROGRESS > TODO+COMPLETED mix > TODO > COMPLETED.
    if (statuses.includes(EventStatus.IN_PROGRESS)) {
      return EventStatus.IN_PROGRESS;
    }

    if (
      statuses.includes(EventStatus.TODO) &&
      statuses.includes(EventStatus.COMPLETED)
    ) {
      return EventStatus.IN_PROGRESS;
    }

    if (statuses.includes(EventStatus.TODO)) {
      return EventStatus.TODO;
    }

    return EventStatus.COMPLETED;
  }

  private async rewriteEvents(
    sourceEvents: EventEntity[],
    drafts: MergedDraft[],
    eventRepository: Repository<EventEntity>,
  ): Promise<EventEntity[]> {
    await eventRepository.remove(sourceEvents);

    const mergedEvents = drafts.map((draft) =>
      eventRepository.create({
        title: [...draft.titles].join(' | '),
        description:
          draft.descriptions.size > 0
            ? [...draft.descriptions].join(' | ')
            : null,
        status: this.pickMergedStatus(draft.statuses),
        startTime: draft.startTime,
        endTime: draft.endTime,
        invitees: [...draft.invitees.values()],
      }),
    );

    return eventRepository.save(mergedEvents);
  }

  private async syncUsersEventStrings(
    userIds: number[],
    manager?: EntityManager,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return;
    }

    const userRepository = manager
      ? manager.getRepository(UserEntity)
      : this.usersRepository;

    const users = await userRepository.find({
      where: { id: In(uniqueUserIds) },
      relations: { invitedEvents: true },
    });

    // Keep `users.events` (list of event ids) synchronized with the relation table.
    for (const user of users) {
      user.events = user.invitedEvents.map((event) => String(event.id));
    }

    await userRepository.save(users);
  }
}

type MergedDraft = {
  startTime: Date;
  endTime: Date;
  titles: Set<string>;
  descriptions: Set<string>;
  statuses: EventStatus[];
  invitees: Map<number, UserEntity>;
};
