import { Controller, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { MAX_RESUME_BYTES, ResumeService, UploadedPdf } from './resume.service';

type AuthenticatedRequest = { user: { uid: string } };

@ApiTags('Resume')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller(['resume', 'api/resume'])
export class ResumeController {
  constructor(private readonly resumes: ResumeService) {}

  @ApiOperation({ summary: 'Read a resume PDF and map its skills onto the topics the app can ask about. The file is not stored.' })
  @ApiConsumes('multipart/form-data')
  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_RESUME_BYTES, files: 1 } }))
  analyze(@Request() req: AuthenticatedRequest, @UploadedFile() file: UploadedPdf | undefined) {
    return this.resumes.analyze(req.user.uid, file);
  }
}
