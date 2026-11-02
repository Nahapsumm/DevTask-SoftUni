import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, createTaskId, updateTask, deleteTask, validateTask, filterTasks, getStats, isValidDate, localDate, validateStoredTasks, ValidationError } from '../src/model.js';
import { demoTasks } from '../src/demo.js';
import { escapeHtml, renderTasks } from '../src/ui.js';

const values = { title: 'Тестова задача', project: 'SoftUni', status: 'todo', priority: 'medium', dueDate: '', description: '' };
const task = (overrides = {}, id = 'a') => createTask({ ...values, ...overrides }, { id, now: '2026-11-02T10:00:00.000Z' });

test('generates a v4 identifier when HTTP preview has no randomUUID', () => {
  const provider = { getRandomValues(bytes) { bytes.fill(17); return bytes; } };
  assert.match(createTaskId(provider), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('creates a task and trims text fields', () => {
  const result = task({ title: '  План  ', project: '  Курс  ' });
  assert.equal(result.title, 'План'); assert.equal(result.project, 'Курс');
  assert.equal(result.id, 'a'); assert.equal(result.createdAt, result.updatedAt);
});
test('rejects empty or whitespace-only titles', () => {
  for (const title of ['', '  ', undefined, null, 15]) assert.throws(() => validateTask({ ...values, title }), ValidationError);
});
test('enforces length limits at their boundaries', () => {
  assert.equal(task({ title: 'a'.repeat(120) }).title.length, 120);
  assert.throws(() => task({ title: 'a'.repeat(121) }), ValidationError);
  assert.throws(() => task({ project: 'a'.repeat(49) }), ValidationError);
  assert.throws(() => task({ description: 'a'.repeat(1001) }), ValidationError);
});
test('rejects unsupported statuses and priorities', () => {
  assert.throws(() => task({ status: 'finished' }), ValidationError);
  assert.throws(() => task({ priority: 'urgent' }), ValidationError);
});
test('validates actual calendar dates including leap years', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-31', '2026-13-01', '02/11/2026', 123, 'bad']) assert.equal(isValidDate(date), false);
  assert.throws(() => task({ dueDate: '2026-02-31' }), ValidationError);
  assert.equal(task({ dueDate: '2026-11-02' }).dueDate, '2026-11-02');
});
test('formats local calendar dates without UTC conversion', () => {
  assert.equal(localDate(new Date(2026, 0, 3, 0, 10)), '2026-01-03');
});
test('updates immutably and preserves task identity and creation time', () => {
  const original = task(); const other = task({}, 'b'); const initial = [original, other];
  const updated = updateTask(initial, 'a', { title: 'Променена', status: 'done' }, '2026-11-03T12:00:00Z');
  assert.notEqual(updated, initial); assert.equal(original.title, 'Тестова задача');
  assert.equal(updated[0].title, 'Променена'); assert.equal(updated[0].createdAt, original.createdAt);
  assert.equal(updated[0].id, 'a'); assert.equal(updated[1], other);
  assert.equal(updated[0].updatedAt, '2026-11-03T12:00:00Z');
});
test('invalid edit does not change the original task', () => {
  const original = task(); assert.throws(() => updateTask([original], 'a', { title: ' ' }), ValidationError);
  assert.equal(original.title, values.title);
});
test('reports missing tasks during update and deletion', () => {
  assert.throws(() => updateTask([], 'missing', values)); assert.throws(() => deleteTask([], 'missing'));
});
test('deletes only the requested task without mutating the array', () => {
  const initial = [task({}, 'a'), task({}, 'b')]; const next = deleteTask(initial, 'a');
  assert.equal(initial.length, 2); assert.deepEqual(next.map(item => item.id), ['b']);
});
test('searches Cyrillic text case-insensitively in title, project and description', () => {
  const tasks = [task({ title: 'Проверка', project: 'КУРС', description: 'Валидация' })];
  for (const query of ['пРоВеРкА', ' курс ', 'ВАЛИДАЦИЯ']) assert.equal(filterTasks(tasks, { query }).length, 1);
  assert.equal(filterTasks(tasks, { query: 'няма' }).length, 0);
});
test('combines query, status, priority and project filters', () => {
  const tasks = [task({ title: 'Тест', status: 'done', priority: 'high' }, 'a'), task({ title: 'Тест', priority: 'high' }, 'b')];
  assert.deepEqual(filterTasks(tasks, { query: 'тест', status: 'done', priority: 'high', project: 'SoftUni' }).map(item => item.id), ['a']);
  assert.equal(filterTasks(tasks, { project: 'Друг' }).length, 0);
});
test('today view includes only tasks on the local requested date', () => {
  const tasks = [task({ dueDate: '2026-11-02' }, 'a'), task({ dueDate: '2026-11-01' }, 'b'), task({}, 'c')];
  assert.deepEqual(filterTasks(tasks, { view: 'today', today: '2026-11-02' }).map(item => item.id), ['a']);
});
test('completed view includes completed tasks only', () => {
  assert.equal(filterTasks([task(), task({ status: 'done' }, 'b')], { view: 'done' }).length, 1);
});
test('sorts by priority and deadline without mutating source order', () => {
  const tasks = [task({ priority: 'low' }, 'a'), task({ priority: 'high', dueDate: '2026-11-03' }, 'b'), task({ priority: 'medium', dueDate: '2026-11-02' }, 'c')];
  assert.deepEqual(filterTasks(tasks, { sort: 'priority' }).map(item => item.id), ['b', 'c', 'a']);
  assert.deepEqual(filterTasks(tasks, { sort: 'due' }).map(item => item.id), ['c', 'b', 'a']);
  assert.deepEqual(tasks.map(item => item.id), ['a', 'b', 'c']);
});
test('calculates stats, overdue count and empty progress correctly', () => {
  assert.equal(getStats([]).percent, 0);
  const tasks = [task({ status: 'done', dueDate: '2026-11-01' }, 'a'), task({ status: 'in-progress', dueDate: '2026-11-01' }, 'b'), task({ dueDate: '2026-11-02' }, 'c')];
  assert.deepEqual(getStats(tasks, '2026-11-02'), { total: 3, inProgress: 1, done: 1, today: 1, overdue: 1, percent: 33 });
});
test('rejects duplicate identities and malformed stored timestamps', () => {
  assert.throws(() => validateStoredTasks([task(), task()]));
  assert.throws(() => validateStoredTasks([{ ...task(), createdAt: 'invalid' }]));
  assert.throws(() => validateStoredTasks({ tasks: [] }));
});
test('escapes HTML characters in user-controlled content', () => {
  assert.equal(escapeHtml('<img src=x onerror="x()">&\''), '&lt;img src=x onerror=&quot;x()&quot;&gt;&amp;&#39;');
});
test('renders injected markup as text including attribute values', () => {
  const container = { innerHTML: '' };
  renderTasks(container, [task({ title: '<script>alert(1)</script>', project: '" onmouseover="x' })]);
  assert.equal(container.innerHTML.includes('<script>'), false);
  assert.equal(container.innerHTML.includes('&lt;script&gt;'), true);
  assert.equal(container.innerHTML.includes('project-dot'), true);
});
test('demo data is valid and uses the supplied calendar date', () => {
  const demo = demoTasks(new Date(2026, 10, 2, 12));
  assert.equal(validateStoredTasks(demo).length, 7);
  assert.equal(getStats(demo, '2026-11-02').today, 2);
  assert.equal(getStats(demo).done, 2);
});
