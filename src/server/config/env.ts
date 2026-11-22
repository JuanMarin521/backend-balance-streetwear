/**
 * Configuration boundary for server-only code.
 *
 * The implementation remains in lib/env for backwards compatibility with the
 * existing tests and integrations. New server code should import from this
 * layer so environment access does not leak into controllers or repositories.
 */
export { getServerEnv, parseServerEnv } from '@/lib/env';
export type { ServerEnv } from '@/lib/env';
