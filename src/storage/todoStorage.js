// Todo 목록 저장소입니다. localStorage 접근을 이 파일에 모아 나중에 DB/API로 교체하기 쉽게 합니다.
export const TODO_STORAGE_KEY = 'todo-list.todos.v1';

export const getTodoStorageKey = (userId) =>
  userId ? `${TODO_STORAGE_KEY}.${encodeURIComponent(userId)}` : TODO_STORAGE_KEY;

export const loadTodos = (fallbackTodos, storageKey = TODO_STORAGE_KEY) => {
  try {
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return fallbackTodos;
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue.todos)) {
      return fallbackTodos;
    }

    return parsedValue.todos;
  } catch {
    return fallbackTodos;
  }
};

export const saveTodos = (todos, storageKey = TODO_STORAGE_KEY) => {
  const payload = {
    version: 1,
    todos
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
};
