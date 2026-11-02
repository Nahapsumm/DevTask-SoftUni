import { createTask, localDate } from './model.js';

export function demoTasks(now = new Date()) {
  const day = offset => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return localDate(date);
  };
  return [
    ['Финални тестове на приложението', 'SoftUni', 'in-progress', 'high', 0, 'Провери валидацията и запазването след презареждане.'],
    ['Подготви документа за курсовия проект', 'SoftUni', 'todo', 'high', 2, 'Архитектура, AI взаимодействия и снимки на работещата система.'],
    ['Нова начална страница', 'ARC Web Studio', 'in-progress', 'medium', 3, 'Прегледай оформлението на мобилен екран.'],
    ['Раздели логиката на модули', 'SoftUni', 'done', 'medium', -1, 'Отделни файлове за данни, интерфейс и съхранение.'],
    ['Идеи за следващия проект', 'Лични', 'todo', 'low', 5, 'Запиши три идеи за полезни малки приложения.'],
    ['Проверка на достъпността', 'ARC Web Studio', 'todo', 'medium', 0, 'Клавиатура, контраст и етикети на полетата.'],
    ['Създай структурата на проекта', 'SoftUni', 'done', 'low', -2, 'Начална структура и локален сървър.'],
  ].map(([title, project, status, priority, offset, description], index) => createTask({ title, project, status, priority, description, dueDate: day(offset) }, { now: new Date(now.getTime() - index * 60000).toISOString() }));
}
  
