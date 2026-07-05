import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthUser } from '../strategies/jwt.strategy';

function makeContext(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const baseUser: AuthUser = {
  sub: 'user-1',
  orgId: 'org-1',
  email: 'test@example.com',
  role: 'MEMBER',
};

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows any authenticated user through when no @Roles() is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });

  it('allows the request when the user has one of the required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['OWNER', 'ADMIN']);
    const owner: AuthUser = { ...baseUser, role: 'OWNER' };
    expect(guard.canActivate(makeContext(owner))).toBe(true);
  });

  it('throws ForbiddenException when the user role is not in the required set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['OWNER', 'ADMIN']);
    expect(() => guard.canActivate(makeContext(baseUser))).toThrow(ForbiddenException);
  });

  it('returns false when there is no user on the request at all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['OWNER']);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});
