import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { organizations, users } from '../db/schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AppRole } from './decorators/roles.decorator';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: AppRole;
  avatar: string | null;
}

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // First user in a new org is always the OWNER.
    const [org] = await this.db.insert(organizations).values({ name: dto.orgName }).returning();

    const [user] = await this.db
      .insert(users)
      .values({
        orgId: org.id,
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: 'OWNER',
      })
      .returning();

    const tokens = await this.issueTokens(user);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return { user: this.toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email.toLowerCase()),
    });

    // Same message whether the email is unknown or the password is wrong —
    // don't let the error response reveal which emails are registered.
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.issueTokens(user);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(userId: string, presentedRefreshToken: string): Promise<AuthTokens> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const matches = await bcrypt.compare(presentedRefreshToken, user.hashedRefreshToken);
    if (!matches) throw new UnauthorizedException('Access denied');

    const tokens = await this.issueTokens(user);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.db.update(users).set({ hashedRefreshToken: null }).where(eq(users.id, userId));
  }

  // ── internals ─────────────────────────────────────────

  private async issueTokens(user: {
    id: string;
    orgId: string;
    email: string;
    role: AppRole;
  }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.db.update(users).set({ hashedRefreshToken }).where(eq(users.id, userId));
  }

  private toPublicUser(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
    };
  }
}
