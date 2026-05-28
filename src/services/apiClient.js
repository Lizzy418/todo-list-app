// 서버 API 호출을 모아두는 클라이언트입니다. 인증 토큰 저장과 JSON 요청 처리를 담당합니다.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : '');
export const AUTH_TOKEN_KEY = 'todo-list.auth.token.v1';

export const getAuthToken = () => window.localStorage.getItem(AUTH_TOKEN_KEY);

export const setAuthToken = (token) => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export const apiRequest = async (path, { method = 'GET', body, token = getAuthToken() } = {}) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.');
  }

  if (response.status === 401 && token) {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new AuthError('로그인이 만료되었습니다. 다시 로그인하세요.');
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || '요청을 처리하지 못했습니다.');
  }

  return data;
};
