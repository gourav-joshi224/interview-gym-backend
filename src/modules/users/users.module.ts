import { Module } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { StorageModule } from '../storage/storage.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StorageModule],
  controllers: [UsersController],
  providers: [UsersService, FirebaseAuthGuard],
})
export class UsersModule {}
