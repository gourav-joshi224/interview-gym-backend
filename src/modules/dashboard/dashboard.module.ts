import { Module } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { StorageModule } from '../storage/storage.module';
import { DashboardController } from './dashboard.controller';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@Module({
  imports: [StorageModule],
  controllers: [DashboardController],
  providers: [ApiKeyGuard, FirebaseAuthGuard],
})
export class DashboardModule {}
