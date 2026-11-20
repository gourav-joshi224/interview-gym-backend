import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { QuestionGeneratorService } from './question-generator.service';

@Module({
  imports: [LlmModule],
  providers: [QuestionGeneratorService],
  exports: [QuestionGeneratorService],
})
export class QuestionsModule {}
