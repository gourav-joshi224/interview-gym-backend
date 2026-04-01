import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  constructor(private readonly storageService: StorageService) {}

  async upsertUser(input: { uid: string; name: string; email: string }): Promise<{ ok: boolean }> {
    await this.storageService.upsertUser(input.uid, input.name, input.email);
    return { ok: true };
  }
}
