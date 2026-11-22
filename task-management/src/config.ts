import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: Set<string>;
  jwtSecret: string;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  trustProxy: boolean;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);
  const corsOrigins = new Set(
    parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  );

  if (corsOrigins.has('*')) {
    throw new Error('CORS_ORIGINS must contain explicit origins; wildcard is not allowed');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    corsOrigins,
    jwtSecret: parsed.JWT_SECRET,
    sessionTtlSeconds: parsed.SESSION_TTL_SECONDS,
    cookieSecure: parsed.COOKIE_SECURE === 'true',
    trustProxy: parsed.TRUST_PROXY === 'true',
  };
}
