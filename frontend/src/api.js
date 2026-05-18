import { localApi } from './localApi';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const isRemoteApiEnabled = Boolean(API_BASE_URL);

async function request(path, options = {}) {
  if (!isRemoteApiEnabled) {
    throw new Error('Không có backend API, vui lòng dùng local mode');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const remoteApi = {
  getQuestions: (filters = {}) => {
    const query = new URLSearchParams(filters)
    return request(`/questions${query.toString() ? `?${query.toString()}` : ''}`)
  },
  importCsv: (csvText) =>
    request('/questions/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvText }),
    }),
  updateQuestion: (id, payload) =>
    request(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteQuestion: (id) =>
    request(`/questions/${id}`, {
      method: 'DELETE',
    }),
  resetDatabase: () =>
    request('/database', {
      method: 'DELETE',
    }),
  getSets: () => request('/sets'),
  createQuiz: (payload) =>
    request('/quiz', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitAttempt: (payload) =>
    request('/attempts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAttempts: (userId) => {
    const query = userId ? `?${new URLSearchParams({ userId }).toString()}` : ''
    return request(`/attempts${query}`)
  },
}

export const api = isRemoteApiEnabled ? remoteApi : localApi
