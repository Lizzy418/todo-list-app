// 백엔드 연결 전까지 화면과 상호작용을 확인하기 위한 임시 mock 데이터입니다.
export const mockTodos = [
  {
    id: 'mock-1',
    title: '투두리스트 기본 화면 만들기',
    completed: true,
    createdAt: '2026-05-27T09:00:00.000Z',
    dueDate: '2026-05-27',
    priority: 'high',
    tags: ['업무']
  },
  {
    id: 'mock-2',
    title: '컴포넌트 구조 나누기',
    completed: false,
    createdAt: '2026-05-27T09:10:00.000Z',
    dueDate: '2026-05-26',
    priority: 'normal',
    tags: ['공부']
  },
  {
    id: 'mock-3',
    title: '다음 단계 기능 목록 정리하기',
    completed: false,
    createdAt: '2026-05-27T09:20:00.000Z',
    dueDate: '2026-05-28',
    priority: 'low',
    tags: ['개인', '장보기']
  }
];
