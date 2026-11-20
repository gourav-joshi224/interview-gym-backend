import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_ANSWER_CHARS = 8000;

export class ProgressSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId!: string;

  @ApiProperty({ example: 'javascript.event-loop::a1b2c3d4' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  questionId!: string;

  @ApiProperty({ description: 'The candidate answer to the current question' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ANSWER_CHARS)
  answer!: string;
}
