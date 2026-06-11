import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
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

export default axiosClient;
