import axios from 'axios';

const authApi = axios.create({
  baseURL: '/api/auth',
  withCredentials: true,
});

export const authService = {
  // Get current user info
  getCurrentUser: async () => {
    try {
      const response = await authApi.get('/user');
      return response.data.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  },
  
  // Login function
  login: async (email, password) => {
    try {
      const response = await authApi.post('/login', { email, password });
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      await authApi.post('/logout');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect anyway
      window.location.href = '/login';
    }
  },

  // Check if user has superadmin role
  isSuperAdmin: (user) => {
    return user && user.role === 'superadmin';
  },

  // Get auth token from cookie
  getToken: () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token') {
        return value;
      }
    }
    return null;
  },
};