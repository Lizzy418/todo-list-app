// Mock 인증 저장소입니다. 실제 서버/DB 연결 전까지 사용자와 세션을 localStorage에 저장합니다.
export const AUTH_USERS_KEY = 'todo-list.auth.users.v1';
export const AUTH_SESSION_KEY = 'todo-list.auth.session.v1';

const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const passwordMinLength = 8;

const loadUsers = () => {
  try {
    const storedUsers = window.localStorage.getItem(AUTH_USERS_KEY);
    const parsedUsers = storedUsers ? JSON.parse(storedUsers) : [];

    return Array.isArray(parsedUsers) ? parsedUsers : [];
  } catch {
    return [];
  }
};

const saveUsers = (users) => {
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
};

export const getCurrentUser = () => {
  try {
    const storedSession = window.localStorage.getItem(AUTH_SESSION_KEY);
    const session = storedSession ? JSON.parse(storedSession) : null;

    return session?.user ?? null;
  } catch {
    return null;
  }
};

export const signUp = ({ email, password, passwordConfirm }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || !passwordConfirm) {
    return { ok: false, error: '이메일과 비밀번호를 입력하세요.' };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, error: '올바른 이메일 형식을 입력하세요.' };
  }

  if (password.length < passwordMinLength) {
    return { ok: false, error: `비밀번호는 최소 ${passwordMinLength}자 이상이어야 합니다.` };
  }

  if (password !== passwordConfirm) {
    return { ok: false, error: '비밀번호 확인이 일치하지 않습니다.' };
  }

  const users = loadUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    return { ok: false, error: '이미 가입된 이메일입니다.' };
  }

  const user = {
    id: normalizedEmail,
    email: normalizedEmail,
    password
  };

  saveUsers([...users, user]);

  return { ok: true, user: { id: user.id, email: user.email } };
};

export const login = ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail) || password.length < passwordMinLength) {
    return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const user = loadUsers().find(
    (storedUser) => storedUser.email === normalizedEmail && storedUser.password === password
  );

  if (!user) {
    return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const sessionUser = { id: user.id, email: user.email };
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ user: sessionUser }));

  return { ok: true, user: sessionUser };
};

export const logout = () => {
  window.localStorage.removeItem(AUTH_SESSION_KEY);
};
