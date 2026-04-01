import { Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorageService } from '../storage/storage.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Dashboard')
@Controller(['dashboard', 'api/dashboard'])
export class DashboardController {
  constructor(private readonly storageService: StorageService) {}

  @ApiOperation({ summary: 'List recent interviews' })
  @Get('interviews')
  @UseGuards(ApiKeyGuard, FirebaseAuthGuard)
  async interviews(@Query('limit') limit?: string): Promise<Array<Record<string, unknown>>> {
    const safeLimit = Math.min(Math.max(parseInt(limit ?? '10', 10), 1), 50);
    return this.storageService.getRecentInterviews(safeLimit);
  }

  @ApiOperation({ summary: 'List sessions for the authenticated user' })
  @Get('my-sessions')
  @UseGuards(FirebaseAuthGuard)
  async mySessions(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const safeLimit = Math.min(Math.max(parseInt(limit ?? '10', 10), 1), 50);
    return this.storageService.getSessionsByUserId(req.user.uid, safeLimit);
  }

  @ApiOperation({ summary: 'List full interview session documents for a specific user id' })
  @Get('sessions-by-user')
  @UseGuards(ApiKeyGuard)
  async sessionsByUser(
    @Query('uid') uid?: string,
    @Query('limit') limit?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const safeUid = uid?.trim();
    const safeLimit = Math.min(Math.max(parseInt(limit ?? '20', 10), 1), 100);

    if (!safeUid) {
      return [];
    }

    return this.storageService.getDetailedSessionsByUserId(safeUid, safeLimit);
  }

  @ApiOperation({ summary: 'Remove legacy fields from interview session documents for a specific user id' })
  @Post('cleanup-session-fields')
  @UseGuards(ApiKeyGuard)
  async cleanupSessionFields(
    @Query('uid') uid?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    scanned: number;
    cleaned: number;
    unchanged: number;
    sessions: Array<{ sessionId: string; removedFields: string[] }>;
  }> {
    const safeUid = uid?.trim();
    const safeLimit = Math.min(Math.max(parseInt(limit ?? '100', 10), 1), 500);

    if (!safeUid) {
      return {
        scanned: 0,
        cleaned: 0,
        unchanged: 0,
        sessions: [],
      };
    }

    return this.storageService.cleanupInterviewSessionFieldsByUserId(safeUid, safeLimit);
  }

  @ApiOperation({ summary: 'Delete every document from the interviewSessions collection' })
  @Post('clear-interview-sessions')
  @UseGuards(ApiKeyGuard)
  async clearInterviewSessions(): Promise<{
    scanned: number;
    deleted: number;
    failed: number;
    sessionIds: string[];
  }> {
    return this.storageService.deleteAllInterviewSessions();
  }
}
