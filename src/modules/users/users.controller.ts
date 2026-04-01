import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { SyncUserDto } from './dto/sync-user.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Users')
@Controller(['users', 'api/users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Sync the authenticated user profile' })
  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async syncUser(
    @Request() req: AuthenticatedRequest,
    @Body() body: SyncUserDto,
  ): Promise<{ ok: boolean }> {
    return this.usersService.upsertUser({
      uid: req.user.uid,
      name: body.name,
      email: body.email,
    });
  }
}
