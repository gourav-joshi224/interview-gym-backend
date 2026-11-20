import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { StorageService } from '../storage/storage.service';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller(['dashboard', 'api/dashboard'])
export class DashboardController {
  constructor(private readonly storage: StorageService) {}

  @ApiOperation({ summary: 'Recent sessions for the signed-in user' })
  @Get('my-sessions')
  mySessions(@Request() req: AuthenticatedRequest, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '20', 10);
    const safeLimit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 20, 1), 50);
    return this.storage.listSessionSummaries(req.user.uid, safeLimit);
  }
}
