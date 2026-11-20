import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LEVELS, Level } from '../../../domain/levels';

export const SESSION_MODES = ['standard', 'resume'] as const;

export class ResumeSkillDto {
  @ApiProperty({ example: 'nodejs' })
  @IsString()
  @MaxLength(60)
  topicId!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  subtopicIds?: string[];

  @ApiProperty({ enum: ['core', 'used', 'mentioned'] })
  @IsIn(['core', 'used', 'mentioned'])
  strength!: 'core' | 'used' | 'mentioned';
}

export class StartSessionDto {
  @ApiPropertyOptional({ enum: SESSION_MODES, default: 'standard' })
  @IsOptional()
  @IsIn(SESSION_MODES as unknown as string[])
  mode?: 'standard' | 'resume';

  @ApiPropertyOptional({ example: 'system-design', description: 'Topic id from GET /curriculum. Required unless mode is "resume".' })
  @ValidateIf((dto: StartSessionDto) => dto.mode !== 'resume')
  @IsString()
  @MaxLength(60)
  topic?: string;

  @ApiProperty({ enum: LEVELS, example: 'intermediate' })
  @IsIn(LEVELS as unknown as string[])
  level!: Level;

  @ApiPropertyOptional({ type: [String], description: 'Subtopic ids to restrict a standard session to' })
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

  @ApiPropertyOptional({ type: [ResumeSkillDto], description: 'Skills the user confirmed after resume analysis. Required for mode "resume".' })
  @ValidateIf((dto: StartSessionDto) => dto.mode === 'resume')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => ResumeSkillDto)
  skills?: ResumeSkillDto[];

  @ApiProperty({ example: 5, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  totalQuestions!: number;
}
