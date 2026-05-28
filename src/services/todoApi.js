// Todo API 어댑터입니다. 컴포넌트는 이 객체를 통해 서버 저장소와 통신합니다.
import { apiRequest } from './apiClient.js';

export const todoApi = {
  async listTodos() {
    const data = await apiRequest('/api/todos');
    return data.todos;
  },

  async createTodo(todo) {
    const data = await apiRequest('/api/todos', {
      method: 'POST',
      body: todo
    });
    return data.todo;
  },

  async updateTodo(todoId, patch) {
    const data = await apiRequest(`/api/todos/${todoId}`, {
      method: 'PATCH',
      body: patch
    });
    return data.todo;
  },

  async deleteTodo(todoId) {
    await apiRequest(`/api/todos/${todoId}`, { method: 'DELETE' });
  },

  async clearCompleted() {
    await apiRequest('/api/todos/completed', { method: 'DELETE' });
  }
};
