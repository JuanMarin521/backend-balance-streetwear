import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(100).optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
};

export const createTaskSchema = z.object({
  title: taskFields.title,
  description: taskFields.description,
  status: taskFields.status.default('todo'),
  dueDate: taskFields.dueDate,
}).strict();

export const updateTaskSchema = z.object(taskFields).strict().partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one task field must be provided',
);

export const taskIdSchema = z.object({ id: z.string().uuid() }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
