import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LEVELS, Level } from '../../../domain/levels';

export class StartSessionDto {
  @ApiProperty({ example: 'system-design', description: 'Topic id from GET /curriculum' })
  @IsString()
  @MaxLength(60)
  topic!: string;

  @ApiProperty({ enum: LEVELS, example: 'intermediate' })
  @IsIn(LEVELS as unknown as string[])
  level!: Level;

  @ApiPropertyOptional({ type: [String], description: 'Subtopic ids to restrict the session to' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  subtopics?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Weak concepts to target (used by "retry weak areas")' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  focus?: string[];

  @ApiProperty({ example: 5, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  totalQuestions!: number;
}
