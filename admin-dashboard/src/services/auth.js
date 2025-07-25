import axios from 'axios';

const authApi = axios.create({
  baseURL: '/api/v1/admin/auth',
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
      // Store token in localStorage if provided
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
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
      localStorage.removeItem('token');
      window.location.href = '/admin';
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect anyway
      localStorage.removeItem('token');
      window.location.href = '/admin';
    }
  },

  // Check if user has superadmin role
  isSuperAdmin: (user) => {
    return user && user.role === 'superadmin';
  },

  // Get auth token from localStorage or cookie
  getToken: () => {
    // First check localStorage
    const localToken = localStorage.getItem('token');
    if (localToken) {
      return localToken;
    }
    
    // Then check cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'admin_token' || name === 'token') {
        return value;
      }
    }
    return null;
  },
};