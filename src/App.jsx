// 전체 화면의 최상위 컴포넌트입니다. 나중에 라우터, 로그인 상태, 전역 레이아웃을 붙일 수 있습니다.
import { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen.jsx';
import TodoApp from './components/TodoApp.jsx';
import { getCurrentUser, login, logout, register } from './services/authApi.js';
import { todoAgentApi } from './services/todoAgentApi.js';
import { todoApi } from './services/todoApi.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setCurrentUser(user);
      setIsCheckingSession(false);
    });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      setCurrentUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = async (credentials) => {
    const result = await login(credentials);

    if (result.ok) {
      setCurrentUser(result.user);
    }

    return result;
  };

  const handleSignUp = (credentials) => register(credentials);

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  return (
    <main className="app-shell">
      {isCheckingSession ? (
        <section className="auth-panel" aria-label="세션 확인">
          <p className="auth-message">로그인 상태를 확인하는 중입니다.</p>
        </section>
      ) : currentUser ? (
        <TodoApp
          key={currentUser.id}
          currentUser={currentUser}
          todoClient={todoApi}
          agentClient={todoAgentApi}
          onLogout={handleLogout}
        />
      ) : (
        <AuthScreen onLogin={handleLogin} onSignUp={handleSignUp} />
      )}
    </main>
  );
}
