import argon2 from 'argon2';
import { jwtVerify, SignJWT } from 'jose';
import { parse, serialize } from 'cookie';
import type { Request, Response } from 'express';
import { AppError } from './domain/errors.js';
import type { AppConfig } from './config.js';
import type { Store } from './store.js';
import type { User } from './types.js';

export const SESSION_COOKIE = 'task_session';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function createSessionToken(user: User, config: AppConfig): Promise<string> {
  const secret = new TextEncoder().encode(config.jwtSecret);
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.sessionTtlSeconds}s`)
    .sign(secret);
}

export function setSessionCookie(response: Response, token: string, config: AppConfig): void {
  response.setHeader('Set-Cookie', serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlSeconds,
  }));
}

export function clearSessionCookie(response: Response, config: AppConfig): void {
  response.setHeader('Set-Cookie', serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  }));
}

export async function authenticateRequest(request: Request, store: Store, config: AppConfig): Promise<User> {
  const token = parse(request.headers.cookie ?? '')[SESSION_COOKIE];
  if (!token) throw new AppError(401, 'unauthorized', 'Authentication is required');

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.jwtSecret), {
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') throw new Error('Missing subject');
    const user = store.findUserById(payload.sub);
    if (!user) throw new Error('Unknown subject');
    return user;
  } catch {
    throw new AppError(401, 'unauthorized', 'Authentication is required');
  }
}

export function toPublicUser(user: User) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
