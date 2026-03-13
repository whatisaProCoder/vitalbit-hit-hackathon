import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
});

export const getAuthToken = () => localStorage.getItem('vitalbit_token');
export const setAuthToken = (token) => {
  if (!token) return;
  localStorage.setItem('vitalbit_token', token);
};
export const clearAuthToken = () => localStorage.removeItem('vitalbit_token');

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
