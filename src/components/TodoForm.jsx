// 새 할 일을 입력하고 추가하는 폼 컴포넌트입니다.
// 나중에 마감일, 우선순위 같은 입력 필드를 이곳에 확장할 수 있습니다.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { priorityOptions } from '../utils/todoPriority.js';
import { parseTagInput } from '../utils/todoTags.js';

export default function TodoForm({ onAddTodo }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [customTags, setCustomTags] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tags = parseTagInput(customTags);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setError('할 일을 입력하세요.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const wasAdded = await onAddTodo({ title, dueDate, priority, tags });
    setIsSubmitting(false);

    if (!wasAdded) {
      return;
    }

    setTitle('');
    setDueDate('');
    setPriority('normal');
    setCustomTags('');
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="todo-input">
        할 일 입력
      </label>
      <input
        id="todo-input"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="할 일을 입력하세요"
        disabled={isSubmitting}
      />
      <button type="submit" title="추가" aria-label="할 일 추가" disabled={isSubmitting}>
        <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <fieldset className="tag-picker">
        <legend className="sr-only">할 일 옵션</legend>
        <div className="form-option">
          <label className="sr-only" htmlFor="todo-due-date">
            마감일
          </label>
          <input
            id="todo-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="form-option">
          <label className="sr-only" htmlFor="todo-priority">
            우선순위
          </label>
          <select
            id="todo-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            disabled={isSubmitting}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-option">
          <label className="sr-only" htmlFor="todo-tags">
            태그 직접 입력
          </label>
          <input
            id="todo-tags"
            type="text"
            value={customTags}
            onChange={(event) => setCustomTags(event.target.value)}
            placeholder="태그 직접 입력"
            disabled={isSubmitting}
          />
        </div>
      </fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
