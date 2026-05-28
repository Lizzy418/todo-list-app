// 목록을 좁혀 보는 검색창과 상태 필터 버튼을 담당하는 컴포넌트입니다.
// 나중에 URL 쿼리, 서버 검색, 저장된 사용자 설정과 연결하기 쉬운 UI 경계입니다.
import { Trash2 } from 'lucide-react';

export default function TodoControls({
  searchTerm,
  tagFilter,
  sortMode,
  availableTags,
  completedCount,
  onSearchTermChange,
  onTagFilterChange,
  onSortModeChange,
  onRequestClearCompleted
}) {
  return (
    <section className="todo-controls" aria-label="할 일 검색과 필터">
      <label className="sr-only" htmlFor="todo-search">
        할 일 검색
      </label>
      <input
        className="todo-search-input"
        id="todo-search"
        type="search"
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="할 일 검색"
      />

      <label className="sr-only" htmlFor="todo-sort">
        정렬
      </label>
      <select
        className="todo-sort-select"
        id="todo-sort"
        value={sortMode}
        onChange={(event) => onSortModeChange(event.target.value)}
      >
        <option value="created">최근 추가순</option>
        <option value="priority">우선순위순</option>
      </select>

      <label className="sr-only" htmlFor="todo-tag-filter">
        태그 필터
      </label>
      <select
        className="todo-tag-select"
        id="todo-tag-filter"
        value={tagFilter}
        onChange={(event) => onTagFilterChange(event.target.value)}
      >
        <option value="all">모든 태그</option>
        {availableTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <button
        className="icon-button clear-completed-button"
        type="button"
        onClick={onRequestClearCompleted}
        disabled={completedCount === 0}
        title="완료 전체 삭제"
        aria-label="완료 전체 삭제"
      >
        <Trash2 size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </section>
  );
}
