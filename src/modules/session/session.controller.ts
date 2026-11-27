import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { FinishSessionDto } from './dto/finish-session.dto';
import { ProgressSessionDto } from './dto/progress-session.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { SessionService } from './session.service';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Session')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller(['session', 'api/session'])
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @ApiOperation({ summary: 'Start a session and get the first question' })
  @Post('start')
  start(@Request() req: AuthenticatedRequest, @Body() body: StartSessionDto) {
    return this.sessions.start(req.user.uid, body);
  }

  @ApiOperation({ summary: 'Save the answer to the current question and get the next one' })
  @Post('progress')
  progress(@Request() req: AuthenticatedRequest, @Body() body: ProgressSessionDto) {
    return this.sessions.progress(req.user.uid, body);
  }

  @ApiOperation({ summary: 'Grade a fully answered session and return the report' })
  @Post('finish')
  finish(@Request() req: AuthenticatedRequest, @Body() body: FinishSessionDto) {
    return this.sessions.finish(req.user.uid, body);
  }

  @ApiOperation({ summary: 'Current state of a session, used to resume after a refresh' })
  @Get(':sessionId')
  get(@Request() req: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.get(req.user.uid, sessionId);
  }
}
