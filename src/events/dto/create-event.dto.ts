import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventStatus } from '../event-status.enum';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(EventStatus)
  status: EventStatus;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  inviteeIds?: number[];
}
