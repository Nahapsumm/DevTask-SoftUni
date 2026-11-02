import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask } from '../src/model.js';
import { STORAGE_KEY, loadTasks, saveTasks, clearTasks } from '../src/storage.js';

function memoryStorage(initial) {
  const records = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}
const makeTask = () => createTask({ title: 'Запазване', status: 'todo', priority: 'low' });

test('first launch returns an empty list without errors', () => {
  assert.deepEqual(loadTasks(memoryStorage()), { tasks: [], error: null, raw: null });
});
test('round trips tasks in a versioned JSON envelope', () => {
  const storage = memoryStorage(); const task = makeTask(); saveTasks(storage, [task]);
  assert.deepEqual(loadTasks(storage).tasks, [task]);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1);
});
test('reports corrupted JSON and preserves the original bytes', () => {
  const storage = memoryStorage('{broken'); const result = loadTasks(storage);
  assert.ok(result.error); assert.equal(result.raw, '{broken');
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});
test('rejects unsupported versions without overwriting them', () => {
  const raw = JSON.stringify({ version: 2, tasks: [] }); const storage = memoryStorage(raw);
  assert.ok(loadTasks(storage).error); assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('rejects malformed and duplicate stored task records', () => {
  const task = makeTask();
  for (const tasks of [[{}], [task, task], [{ ...task, status: 'invalid' }], null]) assert.ok(loadTasks(memoryStorage(JSON.stringify({ version: 1, tasks }))).error);
});

test('does not overwrite original storage when top-level JSON values are invalid', () => {
  for (const invalid of [null, 42, true, [], 'plain text']) {
    const raw = JSON.stringify(invalid);
    const storage = memoryStorage(raw);
    const result = loadTasks(storage);
    assert.ok(result.error);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test('handles a blocked storage read', () => {
  assert.ok(loadTasks({ getItem() { throw new Error('SecurityError'); } }).error);
});
test('reports quota errors and leaves existing saved data intact', () => {
  const storage = memoryStorage('original'); storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => saveTasks(storage, [makeTask()]), /Записът не успя/);
  assert.equal(storage.getItem(STORAGE_KEY), 'original');
});
test('invalid records cannot replace an existing saved list', () => {
  const storage = memoryStorage('original');
  assert.throws(() => saveTasks(storage, [{}])); assert.equal(storage.getItem(STORAGE_KEY), 'original');
});
test('explicit reset removes only the application storage key', () => {
  const storage = memoryStorage('broken'); storage.setItem('other-app', 'keep'); clearTasks(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null); assert.equal(storage.getItem('other-app'), 'keep');
});
test('reports blocked reset operations', () => {
  assert.throws(() => clearTasks({ removeItem() { throw new Error('SecurityError'); } }), /не позволява/);
});
