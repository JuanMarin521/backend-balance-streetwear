import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { InMemoryStore } from '../src/store.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  corsOrigins: new Set(['http://localhost:5173']),
  jwtSecret: 'test-secret-that-is-longer-than-32-characters',
  sessionTtlSeconds: 3600,
  cookieSecure: false,
  trustProxy: false,
};

const credentials = {
  email: 'alice@example.com',
  password: 'a-very-strong-password',
  name: 'Alice',
};

function cookies(response: request.Response): string {
  const header = response.headers['set-cookie'];
  return Array.isArray(header) ? header.join('; ') : header ?? '';
}

describe('task management API', () => {
  let store: InMemoryStore;

  afterEach(() => {
    store = new InMemoryStore();
  });

  it('requires authentication before reading tasks', async () => {
    const app = createApp(config, store);
    const response = await request(app).get('/api/tasks');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthorized');
  });

  it('rejects an origin outside the explicit CORS allow-list with 403', async () => {
    const app = createApp(config, store);
    const response = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('origin_not_allowed');
  });

  it('rejects invalid and unknown registration input', async () => {
    const app = createApp(config, store);
    const response = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      unexpected: true,
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('creates and reads only the authenticated user’s tasks', async () => {
    const app = createApp(config, store);
    const aliceRegistration = await request(app).post('/api/auth/register').send(credentials);
    const aliceCookie = cookies(aliceRegistration);
    expect(aliceCookie).toContain('HttpOnly');
    expect(aliceCookie).toContain('SameSite=Strict');
    const taskResponse = await request(app)
      .post('/api/tasks')
      .set('Cookie', aliceCookie)
      .send({ title: 'Private task', description: 'Alice only' });
    expect(taskResponse.status).toBe(201);

    const bobRegistration = await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'another-very-strong-password',
    });
    const bobCookie = cookies(bobRegistration);
    const taskId = taskResponse.body.task.id as string;

    const bobRead = await request(app).get(`/api/tasks/${taskId}`).set('Cookie', bobCookie);
    expect(bobRead.status).toBe(404);
    expect(bobRead.body.error.code).toBe('task_not_found');

    const bobList = await request(app).get('/api/tasks').set('Cookie', bobCookie);
    expect(bobList.status).toBe(200);
    expect(bobList.body.tasks).toEqual([]);
  });

  it('prevents a user from updating or deleting another user’s task', async () => {
    const app = createApp(config, store);
    const alice = await request(app).post('/api/auth/register').send(credentials);
    const aliceCookie = cookies(alice);
    const task = await request(app).post('/api/tasks').set('Cookie', aliceCookie).send({ title: 'Protected' });
    const bob = await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'another-very-strong-password',
    });
    const bobCookie = cookies(bob);

    const update = await request(app)
      .patch(`/api/tasks/${task.body.task.id}`)
      .set('Cookie', bobCookie)
      .send({ title: 'Tampered' });
    const deletion = await request(app)
      .delete(`/api/tasks/${task.body.task.id}`)
      .set('Cookie', bobCookie);
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
  });
});
