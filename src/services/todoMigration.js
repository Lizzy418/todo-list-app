// 기존 localStorage Todo를 서버로 옮기기 위한 준비 함수입니다.
// 자동 실행은 하지 않고, 이후 마이그레이션 UI가 필요할 때 이 함수를 호출하면 됩니다.
import { loadTodos, TODO_STORAGE_KEY } from '../storage/todoStorage.js';

export const loadLegacyTodosForMigration = () => loadTodos([], TODO_STORAGE_KEY);

export const migrateLegacyTodosToServer = async (todoClient, legacyTodos) => {
  const migratedTodos = [];

  for (const todo of legacyTodos) {
    const migratedTodo = await todoClient.createTodo({
      title: todo.title,
      dueDate: todo.dueDate || '',
      priority: todo.priority || 'normal',
      tags: todo.tags || []
    });

    if (todo.completed) {
      migratedTodos.push(await todoClient.updateTodo(migratedTodo.id, { completed: true }));
    } else {
      migratedTodos.push(migratedTodo);
    }
  }

  return migratedTodos;
};
