import { Module } from '@nestjs/common';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { QuestionsModule } from '../questions/questions.module';
import { StorageModule } from '../storage/storage.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [StorageModule, QuestionsModule, EvaluationModule],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
