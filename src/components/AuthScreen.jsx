// mock 인증 흐름을 제공하는 로그인/회원가입 화면입니다.
import { useState } from 'react';

export default function AuthScreen({ onLogin, onSignUp }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoginMode = mode === 'login';
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  const passwordMinLength = 8;

  const resetForm = (nextMode) => {
    setMode(nextMode);
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setError('');
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setError('올바른 이메일 형식을 입력하세요.');
      setMessage('');
      return;
    }

    if (password.length < passwordMinLength) {
      setError(`비밀번호는 최소 ${passwordMinLength}자 이상이어야 합니다.`);
      setMessage('');
      return;
    }

    if (!isLoginMode && password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      setMessage('');
      return;
    }

    setIsSubmitting(true);
    const result = await (isLoginMode
      ? onLogin({ email, password })
      : onSignUp({ email, password, passwordConfirm }));
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      setMessage('');
      return;
    }

    setError('');

    if (!isLoginMode) {
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setMode('login');
      setMessage('회원가입이 완료되었습니다.');
    }
  };

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <header className="auth-header">
        <h1 id="auth-title">{isLoginMode ? '로그인' : '회원가입'}</h1>
      </header>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="auth-email">이메일</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={isSubmitting}
        />

        <label htmlFor="auth-password">비밀번호</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isLoginMode ? 'current-password' : 'new-password'}
          disabled={isSubmitting}
        />

        {!isLoginMode ? (
          <>
            <label htmlFor="auth-password-confirm">비밀번호 확인</label>
            <input
              id="auth-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </>
        ) : null}

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        {message ? <p className="auth-message" role="status">{message}</p> : null}

        {isSubmitting ? <p className="auth-message" role="status">요청을 처리하는 중입니다.</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '처리 중' : isLoginMode ? '로그인' : '회원가입'}
        </button>
      </form>
      <button
        className="auth-mode-button"
        type="button"
        onClick={() => resetForm(isLoginMode ? 'signup' : 'login')}
        disabled={isSubmitting}
      >
        {isLoginMode ? '회원가입' : '로그인'}
      </button>
    </section>
  );
}
