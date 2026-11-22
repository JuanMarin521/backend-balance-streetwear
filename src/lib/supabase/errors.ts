import { ApiError } from '../domain/errors';

interface PgLikeError { code?: string; message?: string; details?: string | null }

/** Maps Postgres/PostgREST errors to stable API errors; rethrows anything unknown. */
export function mapDbError(err: unknown): never {
  const e = err as PgLikeError;
  if (e?.code === '23505') throw new ApiError(409, 'conflict', 'A record with those unique values already exists');
  if (e?.code === '23514') throw new ApiError(409, 'constraint_violation', 'Value violates an inventory constraint (e.g. stock below reserved units)');
  if (e?.code === '23503') throw new ApiError(422, 'invalid_reference', 'Referenced record does not exist');
  throw err;
}
