import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EventEntity } from '../events/event.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'simple-array', default: '' })
  events: string[];

  @ManyToMany(() => EventEntity, (event) => event.invitees)
  invitedEvents: EventEntity[];
}
