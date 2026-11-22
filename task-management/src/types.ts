export type User = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  createdAt: string;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type Task = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};
