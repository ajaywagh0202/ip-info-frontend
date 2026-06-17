import axios from 'axios';

export const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = `${import.meta.env.BASE_URL}admin/login`;
    }

    if (error.response?.status === 403 && !error.config?.skipForbiddenToast) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Access denied.', type: 'error' },
      }));
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong. Please try again.';

    return Promise.reject({
      ...error,
      friendlyMessage:
        error.code === 'ERR_NETWORK'
          ? 'Backend is unavailable. Please confirm the API server is running.'
          : message,
    });
  },
);

export default axiosInstance;
