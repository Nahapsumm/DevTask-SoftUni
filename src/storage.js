import { validateStoredTasks } from './model.js';

export const STORAGE_KEY = 'devtask.tasks.v1';

export function loadTasks(storage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { tasks: [], error: null, raw: null };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1) throw new Error('Неподдържана версия.');
    return { tasks: validateStoredTasks(saved.tasks), error: null, raw };
  } catch (error) {
    return { tasks: [], error: 'Запазените данни не могат да се прочетат. Не са презаписани. Изтегли копие преди да започнеш отначало.', raw };
  }
}

export function saveTasks(storage, tasks) {
  const validTasks = validateStoredTasks(tasks);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks: validTasks }));
  } catch {
    throw new Error('Записът не успя. Провери свободното място и разрешенията на браузъра. Промените не са приложени.');
  }
}

export function clearTasks(storage) {
  try { storage.removeItem(STORAGE_KEY); }
  catch { throw new Error('Браузърът не позволява изчистване на данните.'); }
}
  
