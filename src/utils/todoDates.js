// 마감일 비교를 한곳에 모아 테스트와 화면 로직이 같은 기준을 쓰게 합니다.
export const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const isDueToday = (dueDate, today = getTodayDateString()) => dueDate === today;

export const isOverdue = (todo, today = getTodayDateString()) =>
  Boolean(todo.dueDate) && !todo.completed && todo.dueDate < today;
