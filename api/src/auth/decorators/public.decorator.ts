import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication.
 * Register and login are the only routes that should use this.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
