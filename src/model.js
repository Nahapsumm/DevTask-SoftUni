// Pure task operations: no DOM and no storage access.
export const STATUSES = Object.freeze(['todo', 'in-progress', 'done']);
export const PRIORITIES = Object.freeze(['high', 'medium', 'low']);
export const STATUS_LABELS = Object.freeze({ todo: 'Предстояща', 'in-progress': 'В процес', done: 'Завършена' });
export const PRIORITY_LABELS = Object.freeze({ high: 'Висок', medium: 'Среден', low: 'Нисък' });

export class ValidationError extends Error {
  constructor(errors) {
    super(Object.values(errors)[0]);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateTask(input) {
  const errors = {};
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const project = typeof input?.project === 'string' ? input.project.trim() : '';
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  const dueDate = input?.dueDate ?? '';
  if (!title) errors.title = 'Въведи заглавие на задачата.';
  else if (title.length > 120) errors.title = 'Заглавието може да е до 120 символа.';
  if (project.length > 48) errors.project = 'Името на проекта може да е до 48 символа.';
  if (description.length > 1000) errors.description = 'Описанието може да е до 1000 символа.';
  if (!STATUSES.includes(input?.status)) errors.status = 'Избери валиден статус.';
  if (!PRIORITIES.includes(input?.priority)) errors.priority = 'Избери валиден приоритет.';
  if (dueDate !== '' && !isValidDate(dueDate)) errors.dueDate = 'Въведи валидна дата.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { title, project, description, status: input.status, priority: input.priority, dueDate };
}

export function createTaskId(cryptoProvider = globalThis.crypto) {
  if (typeof cryptoProvider.randomUUID === 'function') return cryptoProvider.randomUUID();
  // getRandomValues also works in HTTP previews where randomUUID is unavailable.
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createTask(input, { id = createTaskId(), now = new Date().toISOString() } = {}) {
  return { ...validateTask(input), id, createdAt: now, updatedAt: now };
}

export function updateTask(tasks, id, input, now = new Date().toISOString()) {
  const existing = tasks.find(task => task.id === id);
  if (!existing) throw new Error('Задачата не е намерена.');
  const values = validateTask({ ...existing, ...input });
  return tasks.map(task => task.id === id ? { ...task, ...values, updatedAt: now } : task);
}

export function deleteTask(tasks, id) {
  if (!tasks.some(task => task.id === id)) throw new Error('Задачата не е намерена.');
  return tasks.filter(task => task.id !== id);
}

export function filterTasks(tasks, { query = '', status = 'all', priority = 'all', project = '', view = 'all', today = localDate(), sort = 'newest' } = {}) {
  const needle = query.trim().toLocaleLowerCase('bg');
  return tasks.filter(task => {
    const text = `${task.title} ${task.project} ${task.description}`.toLocaleLowerCase('bg');
    return (!needle || text.includes(needle)) &&
      (status === 'all' || task.status === status) &&
      (priority === 'all' || task.priority === priority) &&
      (!project || task.project === project) &&
      (view !== 'today' || task.dueDate === today) &&
      (view !== 'done' || task.status === 'done');
  }).sort((a, b) => {
    if (sort === 'priority') return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.createdAt.localeCompare(a.createdAt);
    if (sort === 'due') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || b.createdAt.localeCompare(a.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function getStats(tasks, today = localDate()) {
  const done = tasks.filter(task => task.status === 'done').length;
  return {
    total: tasks.length,
    inProgress: tasks.filter(task => task.status === 'in-progress').length,
    done,
    today: tasks.filter(task => task.dueDate === today).length,
    overdue: tasks.filter(task => task.dueDate && task.dueDate < today && task.status !== 'done').length,
    percent: tasks.length ? Math.round(done / tasks.length * 100) : 0,
  };
}

export function validateStoredTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 5000) throw new Error('Невалиден списък със задачи.');
  const ids = new Set();
  return tasks.map(task => {
    if (!task || typeof task.id !== 'string' || !task.id || task.id.length > 100 || ids.has(task.id)) throw new Error('Невалиден или повтарящ се идентификатор.');
    ids.add(task.id);
    for (const field of ['createdAt', 'updatedAt']) {
      if (typeof task[field] !== 'string' || Number.isNaN(Date.parse(task[field]))) throw new Error('Невалиден времеви запис.');
    }
    return { ...validateTask(task), id: task.id, createdAt: task.createdAt, updatedAt: task.updatedAt };
  });
}
