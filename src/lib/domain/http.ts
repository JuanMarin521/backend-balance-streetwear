import type { APIContext, APIRoute } from 'astro';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { ApiError } from './errors';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** Stable error shape: { error: { code, message, details? } } */
export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return json(
      { error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() } },
      422,
    );
  }
  if (err instanceof ApiError) {
    return json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      err.status,
    );
  }
  console.error('[api] unhandled error', err);
  return json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500);
}

export function handle(fn: (ctx: APIContext) => Promise<Response>): APIRoute {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readBody(request: Request, maxBytes = 64_000): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new ApiError(413, 'payload_too_large', 'Request body too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ApiError(413, 'payload_too_large', 'Request body too large');
  }
  return text;
}

export async function parseJsonBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readBody(request));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, 'invalid_json', 'Body is not valid JSON');
  }
  return schema.parse(parsed);
}

export function parseQuery<S extends ZodTypeAny>(url: URL, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(url.searchParams));
}
