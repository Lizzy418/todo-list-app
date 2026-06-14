// 서버 API 호출을 모아두는 클라이언트입니다. 인증 토큰 저장과 JSON 요청 처리를 담당합니다.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : '');
export const AUTH_TOKEN_KEY = 'todo-list.auth.token.v1';
export const REFRESH_TOKEN_KEY = 'todo-list.auth.refresh-token.v1';

export const getAuthToken = () => window.localStorage.getItem(AUTH_TOKEN_KEY);
export const getRefreshToken = () => window.localStorage.getItem(REFRESH_TOKEN_KEY);

export const setAuthToken = (token) => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const setRefreshToken = (token) => {
  window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

export const setAuthTokens = ({ token, refreshToken }) => {
  setAuthToken(token);
  setRefreshToken(refreshToken);
};

export const clearAuthToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

const rawApiRequest = async (path, { method = 'GET', body, token = getAuthToken() } = {}) => {
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

let refreshPromise = null;

const refreshAuthToken = async () => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new AuthError('로그인이 만료되었습니다. 다시 로그인하세요.');
  }

  if (!refreshPromise) {
    refreshPromise = rawApiRequest('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      token: ''
    })
      .then((data) => {
        setAuthTokens({
          token: data.token,
          refreshToken: data.refreshToken
        });
        return data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const apiRequest = async (
  path,
  { method = 'GET', body, token = getAuthToken(), retryOnUnauthorized = true } = {}
) => {
  if (!token && retryOnUnauthorized && path !== '/api/auth/refresh' && getRefreshToken()) {
    token = await refreshAuthToken();
  }

  try {
    return await rawApiRequest(path, { method, body, token });
  } catch (error) {
    if (
      !(error instanceof AuthError) ||
      !retryOnUnauthorized ||
      !token ||
      path === '/api/auth/refresh'
    ) {
      throw error;
    }

    try {
      const nextToken = await refreshAuthToken();
      return await rawApiRequest(path, { method, body, token: nextToken });
    } catch (refreshError) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw refreshError instanceof AuthError
        ? refreshError
        : new AuthError('로그인이 만료되었습니다. 다시 로그인하세요.');
    }
  }
};
