// 할 일 목록을 렌더링하는 컴포넌트입니다.
// 필터나 정렬이 생기면 이 컴포넌트에 전달되는 todos만 바꾸면 됩니다.
import TodoItem from './TodoItem.jsx';

export default function TodoList({ todos, onToggleTodo, onUpdateTodo, onDeleteTodo }) {
  if (todos.length === 0) {
    return <p className="empty-message">아직 등록된 할 일이 없습니다.</p>;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggleTodo={onToggleTodo}
          onUpdateTodo={onUpdateTodo}
          onDeleteTodo={onDeleteTodo}
        />
      ))}
    </ul>
  );
}
