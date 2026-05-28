// Todo 목록 상태와 저장 타이밍을 연결하는 hook입니다.
// 저장소 구현은 storage/todoStorage.js에 위임해 이후 DB 저장으로 바꾸기 쉽게 둡니다.
import { useEffect, useRef, useState } from 'react';
import { loadTodos, saveTodos } from '../storage/todoStorage.js';

export default function useTodosStorage(initialTodos, storageKey) {
  const [todos, setTodos] = useState(() => loadTodos(initialTodos, storageKey));
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    saveTodos(todos, storageKey);
  }, [todos, storageKey]);

  return [todos, setTodos];
}
