import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../strategies/jwt.strategy';

/**
 * Injects the authenticated user (attached by JwtStrategy) into a controller method.
 * Usage: findMine(@CurrentUser() user: AuthUser)
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
