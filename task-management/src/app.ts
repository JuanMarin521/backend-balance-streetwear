import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { authenticateRequest, clearSessionCookie, createSessionToken, hashPassword, setSessionCookie, toPublicUser, verifyPassword } from './auth.js';
import type { AppConfig } from './config.js';
import { AppError } from './domain/errors.js';
import { createTaskSchema, loginSchema, registerSchema, taskIdSchema, updateTaskSchema } from './domain/schemas.js';
import { InMemoryStore, normalizeEmail, type Store } from './store.js';
import type { User } from './types.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const asyncRoute = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

function requireUser(store: Store, config: AppConfig): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    request.user = await authenticateRequest(request, store, config);
    next();
  });
}

function publicUser(user: User) {
  return toPublicUser(user);
}

function errorHandler(): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON' } });
      return;
    }
    if (error instanceof ZodError) {
      response.status(422).json({
        error: {
          code: 'validation_error',
          message: 'Invalid request',
          fields: error.flatten().fieldErrors,
        },
      });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }
    console.error('[api] unhandled error', error instanceof Error ? error.message : 'unknown error');
    response.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
  };
}

export function createApp(config: AppConfig, store: Store = new InMemoryStore()): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(cors({
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    origin(origin, callback) {
      if (!origin || config.corsOrigins.has(origin)) {
        callback(null, origin ?? false);
        return;
      }
      callback(new AppError(403, 'origin_not_allowed', 'Origin is not allowed'));
    },
  }));
  app.use(express.json({ limit: '32kb', strict: true }));

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  app.post('/api/auth/register', authLimiter, asyncRoute(async (request, response) => {
    const input = registerSchema.parse(request.body);
    const email = normalizeEmail(input.email);
    if (store.findUserByEmail(email)) {
      throw new AppError(409, 'email_in_use', 'An account with that email already exists');
    }
    const passwordHash = await hashPassword(input.password);
    const user = store.createUser({ email, name: input.name, passwordHash });
    const token = await createSessionToken(user, config);
    setSessionCookie(response, token, config);
    response.status(201).json({ user: publicUser(user) });
  }));

  app.post('/api/auth/login', authLimiter, asyncRoute(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = store.findUserByEmail(normalizeEmail(input.email));
    const valid = user ? await verifyPassword(user.passwordHash, input.password) : false;
    if (!user || !valid) throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
    const token = await createSessionToken(user, config);
    setSessionCookie(response, token, config);
    response.json({ user: publicUser(user) });
  }));

  app.post('/api/auth/logout', requireUser(store, config), (_request, response) => {
    clearSessionCookie(response, config);
    response.status(204).send();
  });

  app.get('/api/me', requireUser(store, config), (request, response) => {
    response.json({ user: publicUser(request.user!) });
  });

  const tasks = express.Router();
  tasks.use(requireUser(store, config));
  tasks.get('/', (request, response) => {
    response.json({ tasks: store.listTasksForUser(request.user!.id) });
  });
  tasks.post('/', asyncRoute(async (request, response) => {
    const input = createTaskSchema.parse(request.body);
    const task = store.createTask(request.user!.id, input);
    response.status(201).json({ task });
  }));
  tasks.get('/:id', (request, response) => {
    const { id } = taskIdSchema.parse(request.params);
    const task = store.findTaskForUser(id, request.user!.id);
    if (!task) throw new AppError(404, 'task_not_found', 'Task not found');
    response.json({ task });
  });
  tasks.patch('/:id', asyncRoute(async (request, response) => {
    const { id } = taskIdSchema.parse(request.params);
    const input = updateTaskSchema.parse(request.body);
    const task = store.updateTaskForUser(id, request.user!.id, input);
    if (!task) throw new AppError(404, 'task_not_found', 'Task not found');
    response.json({ task });
  }));
  tasks.delete('/:id', (request, response) => {
    const { id } = taskIdSchema.parse(request.params);
    if (!store.deleteTaskForUser(id, request.user!.id)) {
      throw new AppError(404, 'task_not_found', 'Task not found');
    }
    response.status(204).send();
  });
  app.use('/api/tasks', tasks);

  app.use((_request, _response, next) => next(new AppError(404, 'not_found', 'Route not found')));
  app.use(errorHandler());
  return app;
}

