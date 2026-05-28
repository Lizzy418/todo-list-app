// 모든 테스트에서 jest-dom matcher를 사용할 수 있게 해주는 테스트 초기 설정입니다.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';

const createMemoryStorage = () => {
  let store = {};

  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createMemoryStorage(),
  configurable: true
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});
