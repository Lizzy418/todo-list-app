// TodoApp의 핵심 사용자 흐름을 검증하는 단위 테스트입니다.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TodoApp from './TodoApp.jsx';
import { TODO_STORAGE_KEY } from '../storage/todoStorage.js';

vi.mock('../utils/todoDates.js', () => ({
  getTodayDateString: () => '2026-05-27',
  isDueToday: (dueDate) => dueDate === '2026-05-27',
  isOverdue: (todo) => Boolean(todo.dueDate) && !todo.completed && todo.dueDate < '2026-05-27'
}));

const getTodoInput = () => screen.getByLabelText('할 일 입력');
const setupUser = () => userEvent.setup();
const todoTitles = [
  '투두리스트 기본 화면 만들기',
  '컴포넌트 구조 나누기',
  '다음 단계 기능 목록 정리하기'
];
const getStoredTodos = () => JSON.parse(window.localStorage.getItem(TODO_STORAGE_KEY)).todos;

describe('TodoApp', () => {
  it('할 일을 추가할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(getTodoInput(), '테스트 작성하기');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    expect(screen.getByText('테스트 작성하기')).toBeInTheDocument();
  });

  it('빈 문자열은 추가되지 않는다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    const initialItems = screen.getAllByRole('listitem');
    await user.type(getTodoInput(), '   ');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(initialItems.length);
  });

  it('완료 상태를 토글할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    const checkbox = screen.getByRole('checkbox', { name: '컴포넌트 구조 나누기' });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('할 일을 삭제할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '컴포넌트 구조 나누기 삭제' }));

    expect(screen.queryByText('컴포넌트 구조 나누기')).not.toBeInTheDocument();
  });

  it('추가된 할 일을 수정할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(getTodoInput(), '수정 전 할 일');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));
    await user.click(screen.getByRole('button', { name: '수정 전 할 일 편집' }));
    await user.clear(screen.getByLabelText('할 일 수정'));
    await user.type(screen.getByLabelText('할 일 수정'), '수정 후 할 일');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.queryByText('수정 전 할 일')).not.toBeInTheDocument();
    expect(screen.getByText('수정 후 할 일')).toBeInTheDocument();
  });

  it('전체 필터가 모든 할 일을 보여준다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '전체' }));

    todoTitles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('진행 중 필터가 미완료 할 일만 보여준다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '진행 중' }));

    expect(screen.queryByText('투두리스트 기본 화면 만들기')).not.toBeInTheDocument();
    expect(screen.getByText('컴포넌트 구조 나누기')).toBeInTheDocument();
    expect(screen.getByText('다음 단계 기능 목록 정리하기')).toBeInTheDocument();
  });

  it('완료됨 필터가 완료된 할 일만 보여준다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '완료됨' }));

    expect(screen.getByText('투두리스트 기본 화면 만들기')).toBeInTheDocument();
    expect(screen.queryByText('컴포넌트 구조 나누기')).not.toBeInTheDocument();
    expect(screen.queryByText('다음 단계 기능 목록 정리하기')).not.toBeInTheDocument();
  });

  it('검색어와 일치하는 할 일만 보여준다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(screen.getByLabelText('할 일 검색'), '컴포넌트');

    expect(screen.queryByText('투두리스트 기본 화면 만들기')).not.toBeInTheDocument();
    expect(screen.getByText('컴포넌트 구조 나누기')).toBeInTheDocument();
    expect(screen.queryByText('다음 단계 기능 목록 정리하기')).not.toBeInTheDocument();
  });

  it('할 일 추가 시 마감일과 우선순위를 선택할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(getTodoInput(), '마감일 있는 할 일');
    await user.type(screen.getByLabelText('마감일'), '2026-05-27');
    await user.selectOptions(screen.getByLabelText('우선순위'), 'high');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    expect(screen.getByText('마감일 있는 할 일')).toBeInTheDocument();
    expect(screen.getAllByText('오늘 할 일')).toHaveLength(2);
    expect(screen.getAllByText('우선순위 높음')).toHaveLength(2);
  });

  it('마감일이 오늘인 항목은 오늘 할 일로 구분한다.', () => {
    render(<TodoApp />);

    const todayTodo = screen.getByText('투두리스트 기본 화면 만들기').closest('li');

    expect(todayTodo).toHaveTextContent('오늘 할 일');
  });

  it('마감일이 지난 미완료 항목은 강조 표시한다.', () => {
    render(<TodoApp />);

    const overdueTodo = screen.getByText('컴포넌트 구조 나누기').closest('li');

    expect(overdueTodo).toHaveClass('is-overdue');
    expect(overdueTodo).toHaveTextContent('기한 지남');
  });

  it('우선순위별 정렬 기능을 사용할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(getTodoInput(), '낮은 우선순위 새 할 일');
    await user.selectOptions(screen.getByLabelText('우선순위'), 'low');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));
    await user.selectOptions(screen.getByLabelText('정렬'), 'priority');

    const visibleItems = screen.getAllByRole('listitem');

    expect(visibleItems[0]).toHaveTextContent('투두리스트 기본 화면 만들기');
    expect(visibleItems[1]).toHaveTextContent('컴포넌트 구조 나누기');
    expect(visibleItems[2]).toHaveTextContent('낮은 우선순위 새 할 일');
    expect(visibleItems[3]).toHaveTextContent('다음 단계 기능 목록 정리하기');
  });

  it('태그 입력창만 제공한다.', () => {
    render(<TodoApp />);

    expect(screen.getByLabelText('태그 직접 입력')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '업무' })).not.toBeInTheDocument();
  });

  it('할 일에 태그를 여러 개 지정하고 목록에서 표시할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.type(getTodoInput(), '태그 있는 할 일');
    await user.type(screen.getByLabelText('태그 직접 입력'), '업무, 운동, 건강');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    const taggedTodo = screen.getByText('태그 있는 할 일').closest('li');

    expect(taggedTodo).toHaveTextContent('#업무');
    expect(taggedTodo).toHaveTextContent('#운동');
    expect(taggedTodo).toHaveTextContent('#건강');
  });

  it('태그로 할 일을 필터링할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.selectOptions(screen.getByLabelText('태그 필터'), '공부');

    expect(screen.queryByText('투두리스트 기본 화면 만들기')).not.toBeInTheDocument();
    expect(screen.getByText('컴포넌트 구조 나누기')).toBeInTheDocument();
    expect(screen.queryByText('다음 단계 기능 목록 정리하기')).not.toBeInTheDocument();
  });

  it('완료된 항목을 한 번에 삭제할 수 있다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '완료 전체 삭제' }));

    expect(screen.getByRole('dialog', { name: '완료 항목 삭제' })).toBeInTheDocument();
    expect(screen.getByText('투두리스트 기본 화면 만들기')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.queryByText('투두리스트 기본 화면 만들기')).not.toBeInTheDocument();
    expect(screen.getByLabelText('전체 할 일 수 2')).toBeInTheDocument();
    expect(screen.getByLabelText('완료 개수 0')).toBeInTheDocument();
  });

  it('통계를 표시한다.', () => {
    render(<TodoApp />);

    const stats = screen.getByLabelText('할 일 통계');

    expect(within(stats).getByLabelText('전체 할 일 수 3')).toBeInTheDocument();
    expect(within(stats).getByLabelText('완료 개수 1')).toBeInTheDocument();
    expect(within(stats).getByLabelText('미완료 개수 2')).toBeInTheDocument();
    expect(within(stats).getByLabelText('완료율 33%')).toBeInTheDocument();
  });

  it('새로고침 후 데이터가 유지된다.', async () => {
    const user = setupUser();
    const { unmount } = render(<TodoApp />);

    await user.type(getTodoInput(), '새로고침 후 남을 할 일');
    await user.type(screen.getByLabelText('마감일'), '2026-05-27');
    await user.selectOptions(screen.getByLabelText('우선순위'), 'high');
    await user.type(screen.getByLabelText('태그 직접 입력'), '저장, 확인');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    await waitFor(() => {
      expect(getStoredTodos()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: '새로고침 후 남을 할 일',
            dueDate: '2026-05-27',
            priority: 'high',
            tags: ['저장', '확인']
          })
        ])
      );
    });

    unmount();
    render(<TodoApp />);

    const restoredTodo = screen.getByText('새로고침 후 남을 할 일').closest('li');

    expect(restoredTodo).toHaveTextContent('오늘 할 일');
    expect(restoredTodo).toHaveTextContent('우선순위 높음');
    expect(restoredTodo).toHaveTextContent('#저장');
    expect(restoredTodo).toHaveTextContent('#확인');
  });

  it('삭제 후 저장에 반영된다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('button', { name: '컴포넌트 구조 나누기 삭제' }));

    await waitFor(() => {
      expect(getStoredTodos()).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: '컴포넌트 구조 나누기' })
        ])
      );
    });
  });

  it('완료 상태가 저장된다.', async () => {
    const user = setupUser();
    render(<TodoApp />);

    await user.click(screen.getByRole('checkbox', { name: '컴포넌트 구조 나누기' }));

    await waitFor(() => {
      expect(getStoredTodos()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: '컴포넌트 구조 나누기',
            completed: true
          })
        ])
      );
    });
  });

  it('Todo API 요청 중 로딩 상태를 표시한다.', async () => {
    render(
      <TodoApp
        currentUser={{ id: 'api-user', email: 'api@example.com' }}
        todoClient={{
          listTodos: () => new Promise(() => {})
        }}
      />
    );

    expect(screen.getByText('할 일을 불러오는 중입니다.')).toBeInTheDocument();
  });

  it('Todo API 실패 시 오류 메시지를 표시한다.', async () => {
    const user = setupUser();
    render(
      <TodoApp
        currentUser={{ id: 'api-user', email: 'api@example.com' }}
        todoClient={{
          listTodos: async () => [],
          createTodo: async () => {
            throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');
          }
        }}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('할 일을 불러오는 중입니다.')).not.toBeInTheDocument();
    });
    await user.type(getTodoInput(), '실패할 할 일');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.'
    );
  });
});
