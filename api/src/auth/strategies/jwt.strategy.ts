import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppRole } from '../decorators/roles.decorator';

export interface JwtPayload {
  sub: string; // user id
  orgId: string;
  email: string;
  role: AppRole;
}

export type AuthUser = JwtPayload;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  // Whatever this returns becomes `request.user`
  async validate(payload: JwtPayload): Promise<AuthUser> {
    return payload;
  }
}
