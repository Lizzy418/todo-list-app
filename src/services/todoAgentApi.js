import { apiRequest } from './apiClient.js';

export const todoAgentApi = {
  async run(message) {
    return apiRequest('/api/agent/todo', {
      method: 'POST',
      body: { message }
    });
  }
};
