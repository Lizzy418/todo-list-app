// 투두 기능의 상태와 이벤트를 관리하는 컨테이너 컴포넌트입니다.
// 이후 DB 저장, 로그인 사용자별 목록, 필터 기능은 이 레이어에서 연결하기 좋습니다.
import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import TodoAgentBox from './TodoAgentBox.jsx';
import TodoControls from './TodoControls.jsx';
import TodoForm from './TodoForm.jsx';
import TodoList from './TodoList.jsx';
import TodoStats from './TodoStats.jsx';
import { mockTodos } from '../data/mockTodos.js';
import useTodosStorage from '../hooks/useTodosStorage.js';
import { priorityRank } from '../utils/todoPriority.js';
import { normalizeTags } from '../utils/todoTags.js';

export default function TodoApp({ currentUser, storageKey, todoClient, agentClient, onLogout }) {
  const [localTodos, setLocalTodos] = useTodosStorage(mockTodos, storageKey);
  const [serverTodos, setServerTodos] = useState([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(Boolean(todoClient));
  const todos = todoClient ? serverTodos : localTodos;
  const setTodos = todoClient ? setServerTodos : setLocalTodos;
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortMode, setSortMode] = useState('created');
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  const loadServerTodos = useCallback(async () => {
    if (!todoClient) {
      return;
    }

    setApiError('');
    setIsLoadingTodos(true);

    try {
      setServerTodos(await todoClient.listTodos());
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsLoadingTodos(false);
    }
  }, [todoClient]);

  useEffect(() => {
    loadServerTodos();
  }, [loadServerTodos]);

  const runTodoRequest = async (request) => {
    setApiError('');
    setIsMutating(true);

    try {
      await request();
      return true;
    } catch (error) {
      setApiError(error.message || '요청을 처리하지 못했습니다.');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleAddTodo = async ({ title, dueDate, priority, tags }) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return false;
    }

    const nextTodo = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate,
      priority,
      tags: normalizeTags(tags ?? [])
    };

    if (todoClient) {
      return runTodoRequest(async () => {
        const createdTodo = await todoClient.createTodo(nextTodo);
        setTodos((currentTodos) => [createdTodo, ...currentTodos]);
      });
    }

    setTodos((currentTodos) => [nextTodo, ...currentTodos]);
    return true;
  };

  const handleToggleTodo = async (todoId) => {
    const targetTodo = todos.find((todo) => todo.id === todoId);

    if (!targetTodo) {
      return;
    }

    if (todoClient) {
      await runTodoRequest(async () => {
        const updatedTodo = await todoClient.updateTodo(todoId, {
          completed: !targetTodo.completed
        });
        setTodos((currentTodos) =>
          currentTodos.map((todo) => (todo.id === todoId ? updatedTodo : todo))
        );
      });
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleUpdateTodo = async (todoId, title) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    if (todoClient) {
      await runTodoRequest(async () => {
        const updatedTodo = await todoClient.updateTodo(todoId, { title: trimmedTitle });
        setTodos((currentTodos) =>
          currentTodos.map((todo) => (todo.id === todoId ? updatedTodo : todo))
        );
      });
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, title: trimmedTitle } : todo
      )
    );
  };

  const handleDeleteTodo = async (todoId) => {
    if (todoClient) {
      await runTodoRequest(async () => {
        await todoClient.deleteTodo(todoId);
        setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
      });
      return;
    }

    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
  };

  const handleClearCompleted = async () => {
    if (todoClient) {
      await runTodoRequest(async () => {
        await todoClient.clearCompleted();
        setTodos((currentTodos) => currentTodos.filter((todo) => !todo.completed));
        setIsClearDialogOpen(false);
      });
      return;
    }

    setTodos((currentTodos) => currentTodos.filter((todo) => !todo.completed));
    setIsClearDialogOpen(false);
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const availableTags = normalizeTags(todos.flatMap((todo) => todo.tags ?? []));
  const totalTodos = todos.length;
  const completedTodos = todos.filter((todo) => todo.completed).length;
  const stats = {
    total: totalTodos,
    completed: completedTodos,
    active: totalTodos - completedTodos,
    completionRate: totalTodos === 0 ? 0 : Math.round((completedTodos / totalTodos) * 100)
  };
  const filteredTodos = todos
    .filter((todo) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !todo.completed) ||
        (filter === 'completed' && todo.completed);
      const matchesSearch =
        !normalizedSearchTerm || todo.title.toLowerCase().includes(normalizedSearchTerm);
      const matchesTag = tagFilter === 'all' || (todo.tags ?? []).includes(tagFilter);

      return matchesFilter && matchesSearch && matchesTag;
    })
    .sort((firstTodo, secondTodo) => {
      if (sortMode !== 'priority') {
        return 0;
      }

      return priorityRank[secondTodo.priority] - priorityRank[firstTodo.priority];
    });

  return (
    <section className="todo-panel" aria-labelledby="todo-title">
      <header className="todo-header">
        <h1 id="todo-title">Todo List</h1>
        {currentUser ? (
          <div className="session-bar">
            <span>{currentUser.email}</span>
            <button type="button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        ) : null}
      </header>

      {isLoadingTodos ? <p className="empty-message">할 일을 불러오는 중입니다.</p> : null}
      {isMutating ? <p className="status-message" role="status">요청을 처리하는 중입니다.</p> : null}
      {apiError ? <p className="form-error" role="alert">{apiError}</p> : null}
      {agentClient ? (
        <TodoAgentBox agentClient={agentClient} onTodosChanged={loadServerTodos} />
      ) : null}
      <TodoForm onAddTodo={handleAddTodo} />
      <TodoControls
        searchTerm={searchTerm}
        tagFilter={tagFilter}
        sortMode={sortMode}
        availableTags={availableTags}
        completedCount={completedTodos}
        onSearchTermChange={setSearchTerm}
        onTagFilterChange={setTagFilter}
        onSortModeChange={setSortMode}
        onRequestClearCompleted={() => setIsClearDialogOpen(true)}
      />
      <TodoStats stats={stats} filter={filter} onFilterChange={setFilter} />
      <TodoList
        todos={filteredTodos}
        onToggleTodo={handleToggleTodo}
        onUpdateTodo={handleUpdateTodo}
        onDeleteTodo={handleDeleteTodo}
      />
      {isClearDialogOpen ? (
        <ConfirmDialog
          title="완료 항목 삭제"
          message="완료된 할 일을 모두 삭제하시겠습니까?"
          confirmLabel="삭제"
          cancelLabel="취소"
          onConfirm={handleClearCompleted}
          onCancel={() => setIsClearDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}
