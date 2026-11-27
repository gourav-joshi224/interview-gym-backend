import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { EvaluationService } from './evaluation.service';

@Module({
  imports: [LlmModule],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
