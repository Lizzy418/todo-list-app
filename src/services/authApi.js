// 인증 API 어댑터입니다. UI는 이 파일만 알면 되도록 서버 호출을 캡슐화합니다.
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from './apiClient.js';

export const register = async ({ email, password, passwordConfirm }) => {
  if (password !== passwordConfirm) {
    return { ok: false, error: '비밀번호 확인이 일치하지 않습니다.' };
  }

  try {
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { email: email.trim(), password }
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

export const login = async ({ email, password }) => {
  try {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      token: ''
    });

    setAuthToken(data.token);

    return { ok: true, user: data.user };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

export const getCurrentUser = async () => {
  if (!getAuthToken()) {
    return null;
  }

  try {
    const data = await apiRequest('/api/auth/me');
    return data.user;
  } catch {
    clearAuthToken();
    return null;
  }
};

export const logout = async () => {
  try {
    if (getAuthToken()) {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    }
  } catch {
    // 서버 로그아웃 기록 실패와 관계없이 클라이언트 세션은 정리합니다.
  }

  clearAuthToken();
};
