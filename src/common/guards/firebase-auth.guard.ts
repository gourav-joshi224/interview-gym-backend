import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getFirebaseAdmin } from '../firebase-admin';

type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: { uid: string };
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;
    const bearerValue = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (!bearerValue?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ error: 'AUTH_TOKEN_MISSING' });
    }

    const token = bearerValue.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException({ error: 'AUTH_TOKEN_MISSING' });
    }

    try {
      const admin = getFirebaseAdmin();
      const decoded = await admin.auth().verifyIdToken(token);
      request.user = { uid: decoded.uid };
      return true;
    } catch {
      throw new UnauthorizedException({ error: 'AUTH_TOKEN_INVALID' });
    }
  }
}
