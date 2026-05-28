// 단일 할 일 항목을 표시하는 컴포넌트입니다.
// 완료 체크, 제목 편집, 삭제처럼 한 항목에만 영향을 주는 UI를 이곳에 둡니다.
import { useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { isDueToday, isOverdue } from '../utils/todoDates.js';
import { priorityLabels } from '../utils/todoPriority.js';

export default function TodoItem({ todo, onToggleTodo, onUpdateTodo, onDeleteTodo }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const dueToday = isDueToday(todo.dueDate);
  const overdue = isOverdue(todo);
  const itemClassName = [
    'todo-item',
    todo.completed ? 'is-completed' : '',
    overdue ? 'is-overdue' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const handleStartEdit = () => {
    setDraftTitle(todo.title);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftTitle(todo.title);
    setIsEditing(false);
  };

  const handleSubmitEdit = (event) => {
    event.preventDefault();

    if (!draftTitle.trim()) {
      return;
    }

    onUpdateTodo(todo.id, draftTitle);
    setIsEditing(false);
  };

  return (
    <li className={itemClassName}>
      {isEditing ? (
        <form className="edit-form" onSubmit={handleSubmitEdit}>
          <label className="sr-only" htmlFor={`edit-${todo.id}`}>
            할 일 수정
          </label>
          <input
            id={`edit-${todo.id}`}
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            autoFocus
          />
          <div className="todo-actions">
            <button className="icon-button save-button" type="submit" title="저장" aria-label="저장">
              <Check size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
            <button
              className="icon-button cancel-button"
              type="button"
              onClick={handleCancelEdit}
              title="취소"
              aria-label="취소"
            >
              <X size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="todo-content">
            <label className="todo-check">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggleTodo(todo.id)}
              />
              <span className="todo-title">{todo.title}</span>
            </label>
            <div className="todo-meta">
              {todo.dueDate ? <span className="meta-badge">마감일 {todo.dueDate}</span> : null}
              {dueToday ? <span className="meta-badge today-badge">오늘 할 일</span> : null}
              {overdue ? <span className="meta-badge overdue-badge">기한 지남</span> : null}
            <span className={`meta-badge priority-badge priority-${todo.priority}`}>
              우선순위 {priorityLabels[todo.priority]}
            </span>
            {(todo.tags ?? []).map((tag) => (
              <span key={tag} className="meta-badge tag-badge">
                #{tag}
              </span>
            ))}
          </div>
          </div>
          <div className="todo-actions">
            <button
              className="icon-button edit-button"
              type="button"
              onClick={handleStartEdit}
              title="편집"
              aria-label={`${todo.title} 편집`}
            >
              <Pencil size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              className="icon-button delete-button"
              type="button"
              onClick={() => onDeleteTodo(todo.id)}
              title="삭제"
              aria-label={`${todo.title} 삭제`}
            >
              <Trash2 size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </li>
  );
}
