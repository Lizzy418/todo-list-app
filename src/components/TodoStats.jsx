// 전체 할 일의 진행 현황을 숫자로 요약하는 통계 컴포넌트입니다.
const filters = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'completed', label: '완료됨' }
];

export default function TodoStats({ stats, filter, onFilterChange }) {
  return (
    <section className="todo-stats" aria-label="할 일 통계">
      <div className="stats-summary">
        <span aria-label={`전체 할 일 수 ${stats.total}`}>전체: {stats.total}</span>
        <span aria-label={`완료 개수 ${stats.completed}`}>완료: {stats.completed}</span>
        <span aria-label={`미완료 개수 ${stats.active}`}>미완료: {stats.active}</span>
        <span aria-label={`완료율 ${stats.completionRate}%`}>완료율: {stats.completionRate}%</span>
      </div>
      <div className="filter-group" role="group" aria-label="상태 필터">
        {filters.map((filterOption) => (
          <button
            key={filterOption.value}
            type="button"
            className={filter === filterOption.value ? 'filter-button is-selected' : 'filter-button'}
            onClick={() => onFilterChange(filterOption.value)}
            aria-pressed={filter === filterOption.value}
          >
            {filterOption.label}
          </button>
        ))}
      </div>
    </section>
  );
}
