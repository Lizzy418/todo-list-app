// mock 인증과 사용자별 Todo 저장 흐름을 App 기준으로 검증합니다.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

let authUsers = [];
let currentUser = null;
let todosByUser = {};

vi.mock('./utils/todoDates.js', () => ({
  getTodayDateString: () => '2026-05-27',
  isDueToday: (dueDate) => dueDate === '2026-05-27',
  isOverdue: (todo) => Boolean(todo.dueDate) && !todo.completed && todo.dueDate < '2026-05-27'
}));

vi.mock('./services/authApi.js', () => ({
  getCurrentUser: vi.fn(async () => currentUser),
  register: vi.fn(async ({ email, password, passwordConfirm }) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (password !== passwordConfirm) {
      return { ok: false, error: '비밀번호 확인이 일치하지 않습니다.' };
    }

    if (authUsers.some((user) => user.email === normalizedEmail)) {
      return { ok: false, error: '이미 가입된 이메일입니다.' };
    }

    authUsers.push({ id: normalizedEmail, email: normalizedEmail, password });
    return { ok: true };
  }),
  login: vi.fn(async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === 'loading@example.com') {
      return new Promise(() => {});
    }

    const user = authUsers.find(
      (storedUser) => storedUser.email === normalizedEmail && storedUser.password === password
    );

    if (!user) {
      return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }

    currentUser = { id: user.id, email: user.email };
    return { ok: true, user: currentUser };
  }),
  logout: vi.fn(() => {
    currentUser = null;
  })
}));

vi.mock('./services/todoApi.js', () => ({
  todoApi: {
    listTodos: vi.fn(async () => todosByUser[currentUser?.id] ?? []),
    createTodo: vi.fn(async (todo) => {
      const createdTodo = {
        ...todo,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      todosByUser[currentUser.id] = [createdTodo, ...(todosByUser[currentUser.id] ?? [])];
      return createdTodo;
    }),
    updateTodo: vi.fn(async (todoId, patch) => {
      todosByUser[currentUser.id] = (todosByUser[currentUser.id] ?? []).map((todo) =>
        todo.id === todoId ? { ...todo, ...patch } : todo
      );
      return todosByUser[currentUser.id].find((todo) => todo.id === todoId);
    }),
    deleteTodo: vi.fn(async (todoId) => {
      todosByUser[currentUser.id] = (todosByUser[currentUser.id] ?? []).filter(
        (todo) => todo.id !== todoId
      );
    }),
    clearCompleted: vi.fn(async () => {
      todosByUser[currentUser.id] = (todosByUser[currentUser.id] ?? []).filter(
        (todo) => !todo.completed
      );
    })
  }
}));

const setupUser = () => userEvent.setup();

const renderApp = async () => {
  const renderResult = render(<App />);
  await waitFor(() => {
    expect(screen.queryByText('로그인 상태를 확인하는 중입니다.')).not.toBeInTheDocument();
  });
  return renderResult;
};

const signUp = async (user, email, password = 'password123') => {
  await user.click(screen.getByRole('button', { name: '회원가입' }));
  await user.type(screen.getByLabelText('이메일'), email);
  await user.type(screen.getByLabelText('비밀번호'), password);
  await user.type(screen.getByLabelText('비밀번호 확인'), password);
  await user.click(screen.getByRole('button', { name: '회원가입' }));
};

const login = async (user, email, password = 'password123') => {
  await user.type(screen.getByLabelText('이메일'), email);
  await user.type(screen.getByLabelText('비밀번호'), password);
  await user.click(screen.getByRole('button', { name: '로그인' }));
};

describe('App auth flow', () => {
  beforeEach(() => {
    authUsers = [];
    currentUser = null;
    todosByUser = {};
  });

  it('회원가입 성공', async () => {
    const user = setupUser();
    await renderApp();

    await signUp(user, 'new@example.com');

    expect(screen.getByText('회원가입이 완료되었습니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByLabelText('비밀번호 확인')).not.toBeInTheDocument();
  });

  it('중복 이메일 가입을 방지한다.', async () => {
    const user = setupUser();
    await renderApp();

    await signUp(user, 'dupe@example.com');
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    await user.type(screen.getByLabelText('이메일'), 'dupe@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'password123');
    await user.click(screen.getByRole('button', { name: '회원가입' }));

    expect(screen.getByRole('alert')).toHaveTextContent('이미 가입된 이메일입니다.');
  });

  it('비밀번호 확인 불일치 오류를 표시한다.', async () => {
    const user = setupUser();
    await renderApp();

    await user.click(screen.getByRole('button', { name: '회원가입' }));
    await user.type(screen.getByLabelText('이메일'), 'mismatch@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'different123');
    await user.click(screen.getByRole('button', { name: '회원가입' }));

    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호 확인이 일치하지 않습니다.');
  });

  it('로그인 성공 시 Todo 화면으로 이동한다.', async () => {
    const user = setupUser();
    await renderApp();

    await signUp(user, 'login@example.com');
    await login(user, 'login@example.com');

    expect(screen.getByRole('heading', { name: 'Todo List' })).toBeInTheDocument();
    expect(screen.getByText('login@example.com')).toBeInTheDocument();
  });

  it('로그인 실패 시 오류 메시지를 표시한다.', async () => {
    const user = setupUser();
    await renderApp();

    await login(user, 'missing@example.com', 'wrong-password');

    expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않습니다.');
    expect(screen.queryByRole('heading', { name: 'Todo List' })).not.toBeInTheDocument();
  });

  it('이메일 형식을 검증한다.', async () => {
    const user = setupUser();
    await renderApp();

    await user.type(screen.getByLabelText('이메일'), 'invalid-email');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByRole('alert')).toHaveTextContent('올바른 이메일 형식을 입력하세요.');
  });

  it('비밀번호 최소 길이를 검증한다.', async () => {
    const user = setupUser();
    await renderApp();

    await user.type(screen.getByLabelText('이메일'), 'short@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'short');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호는 최소 8자 이상이어야 합니다.');
  });

  it('인증 요청 중 로딩 상태를 표시한다.', async () => {
    const user = setupUser();
    await renderApp();

    await user.type(screen.getByLabelText('이메일'), 'loading@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByText('요청을 처리하는 중입니다.')).toBeInTheDocument();
  });

  it('로그아웃 가능하다.', async () => {
    const user = setupUser();
    await renderApp();

    await signUp(user, 'logout@example.com');
    await login(user, 'logout@example.com');
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Todo List' })).not.toBeInTheDocument();
  });

  it('새로고침 후 로그인 상태가 유지된다.', async () => {
    const user = setupUser();
    const { unmount } = await renderApp();

    await signUp(user, 'persist@example.com');
    await login(user, 'persist@example.com');

    currentUser = { id: 'persist@example.com', email: 'persist@example.com' };
    unmount();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Todo List' })).toBeInTheDocument();
    expect(screen.getByText('persist@example.com')).toBeInTheDocument();
  });

  it('JWT 만료 또는 인증 실패 시 자동 로그아웃 처리한다.', async () => {
    currentUser = { id: 'expired@example.com', email: 'expired@example.com' };
    await renderApp();

    window.dispatchEvent(new CustomEvent('auth:unauthorized'));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Todo List' })).not.toBeInTheDocument();
  });

  it('사용자별 Todo 목록을 분리한다.', async () => {
    const user = setupUser();
    await renderApp();

    await signUp(user, 'a@example.com');
    await login(user, 'a@example.com');
    await user.type(screen.getByLabelText('할 일 입력'), 'A 사용자만 보는 할 일');
    await user.click(screen.getByRole('button', { name: '할 일 추가' }));
    await waitFor(() => {
      expect(screen.getByText('A 사용자만 보는 할 일')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    await signUp(user, 'b@example.com');
    await login(user, 'b@example.com');

    expect(screen.queryByText('A 사용자만 보는 할 일')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await login(user, 'a@example.com');

    expect(screen.getByText('A 사용자만 보는 할 일')).toBeInTheDocument();
  });

  it('비로그인 상태에서는 Todo 화면에 접근할 수 없다.', async () => {
    await renderApp();

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Todo List' })).not.toBeInTheDocument();
  });
});
