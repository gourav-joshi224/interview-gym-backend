import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { FinishSessionDto } from './dto/finish-session.dto';
import { ProgressSessionDto } from './dto/progress-session.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { SessionService } from './session.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Session')
@Controller(['session', 'api/session'])
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiOperation({ summary: 'Start a new interview session' })
  @Post('start')
  @UseGuards(ApiKeyGuard, FirebaseAuthGuard)
  async start(
    @Request() req: AuthenticatedRequest,
    @Body() payload: StartSessionDto,
  ): Promise<{ sessionId: string; question: string; questionId: string }> {
    return this.sessionService.start({
      ...payload,
      authenticatedUserId: req.user.uid,
    });
  }

  @ApiOperation({ summary: 'Save session progress' })
  @Post('progress')
  @UseGuards(ApiKeyGuard, FirebaseAuthGuard)
  async progress(
    @Request() req: AuthenticatedRequest,
    @Body() payload: ProgressSessionDto,
  ): Promise<{ ok: boolean; question?: string; questionId?: string }> {
    return this.sessionService.progress({
      ...payload,
      authenticatedUserId: req.user.uid,
    });
  }

  @ApiOperation({ summary: 'Finish session and generate report' })
  @Post('finish')
  @UseGuards(ApiKeyGuard, FirebaseAuthGuard)
  async finish(
    @Request() req: AuthenticatedRequest,
    @Body() payload: FinishSessionDto,
  ): Promise<Record<string, unknown>> {
    return this.sessionService.finish({
      ...payload,
      authenticatedUserId: req.user.uid,
    });
  }
}
