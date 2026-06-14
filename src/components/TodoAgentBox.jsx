import { useState } from 'react';
import { Send } from 'lucide-react';

export default function TodoAgentBox({ agentClient, onTodosChanged }) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError('Agent에게 요청할 내용을 입력하세요.');
      return;
    }

    setError('');
    setReply('');
    setIsSubmitting(true);

    try {
      const result = await agentClient.run(trimmedMessage);
      setReply(result.message || '요청을 처리했어요.');

      if (result.action === 'create_todo' || result.action === 'delete_todo') {
        await onTodosChanged();
      }

      setMessage('');
    } catch (requestError) {
      setError(requestError.message || 'Agent 요청을 처리하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="todo-agent" aria-label="Todo AI Agent">
      <form className="todo-agent-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="todo-agent-input">
          AI Agent에게 요청
        </label>
        <input
          id="todo-agent-input"
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="예: 운동하기 추가해줘"
          disabled={isSubmitting}
        />
        <button type="submit" title="Agent 실행" aria-label="Agent 실행" disabled={isSubmitting}>
          <Send size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </form>
      {isSubmitting ? <p className="status-message" role="status">Agent가 처리하는 중입니다.</p> : null}
      {reply ? <p className="agent-reply">{reply}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
