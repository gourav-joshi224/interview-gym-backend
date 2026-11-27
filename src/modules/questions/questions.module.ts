import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { QuestionGeneratorService } from './question-generator.service';
import { QuestionPoolService } from './question-pool.service';

@Module({
  imports: [LlmModule],
  providers: [QuestionGeneratorService, QuestionPoolService],
  exports: [QuestionGeneratorService, QuestionPoolService],
})
export class QuestionsModule {}
