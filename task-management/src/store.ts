import { randomUUID } from 'node:crypto';
import type { CreateTaskInput, RegisterInput, UpdateTaskInput } from './domain/schemas.js';
import type { Task, User } from './types.js';

export interface Store {
  findUserByEmail(email: string): User | undefined;
  findUserById(id: string): User | undefined;
  createUser(input: Omit<RegisterInput, 'password'> & { passwordHash: string }): User;
  listTasksForUser(userId: string): Task[];
  findTaskForUser(taskId: string, userId: string): Task | undefined;
  createTask(userId: string, input: CreateTaskInput): Task;
  updateTaskForUser(taskId: string, userId: string, input: UpdateTaskInput): Task | undefined;
  deleteTaskForUser(taskId: string, userId: string): boolean;
}

export class InMemoryStore implements Store {
  private readonly users = new Map<string, User>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly tasks = new Map<string, Task>();

  findUserByEmail(email: string): User | undefined {
    const id = this.usersByEmail.get(normalizeEmail(email));
    return id ? this.users.get(id) : undefined;
  }

  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  createUser(input: Omit<RegisterInput, 'password'> & { passwordHash: string }): User {
    const user: User = {
      id: randomUUID(),
      email: normalizeEmail(input.email),
      name: input.name ?? null,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    return user;
  }

  listTasksForUser(userId: string): Task[] {
    return [...this.tasks.values()]
      .filter((task) => task.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // The owner predicate is part of the lookup, not a post-fetch authorization check.
  findTaskForUser(taskId: string, userId: string): Task | undefined {
    const task = this.tasks.get(taskId);
    return task?.userId === userId ? task : undefined;
  }

  createTask(userId: string, input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      dueDate: input.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  updateTaskForUser(taskId: string, userId: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.findTaskForUser(taskId, userId);
    if (!existing) return undefined;
    const updated: Task = { ...existing, ...input, updatedAt: new Date().toISOString() };
    this.tasks.set(taskId, updated);
    return updated;
  }

  deleteTaskForUser(taskId: string, userId: string): boolean {
    const existing = this.findTaskForUser(taskId, userId);
    return existing ? this.tasks.delete(taskId) : false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
