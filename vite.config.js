// Vite와 Vitest 공통 설정입니다. React 플러그인과 브라우저 유사 테스트 환경을 지정합니다.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/'
      }
    },
    setupFiles: './src/test/setup.js',
    globals: true
  }
});
