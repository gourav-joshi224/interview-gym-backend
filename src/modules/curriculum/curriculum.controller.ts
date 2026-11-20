import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LEVELS, LEVEL_LABEL, LEVEL_SPEC } from '../../domain/levels';
import { TOPICS } from './curriculum.data';

@ApiTags('Curriculum')
@Controller(['curriculum', 'api/curriculum'])
export class CurriculumController {
  @ApiOperation({ summary: 'Topics, subtopics and levels the app supports (public, cacheable)' })
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  list() {
    return {
      levels: LEVELS.map((id) => ({
        id,
        label: LEVEL_LABEL[id],
        description: LEVEL_SPEC[id].audience,
      })),
      topics: TOPICS.map(({ id, label, description, subtopics }) => ({ id, label, description, subtopics })),
      limits: { minQuestions: 1, maxQuestions: 10 },
    };
  }
}
