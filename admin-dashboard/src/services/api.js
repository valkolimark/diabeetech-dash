import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api/v1/admin',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from cookie or localStorage
    const token = localStorage.getItem('token') || getCookie('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        // Clear auth and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login?redirect=/admin';
      }
      
      // Handle 403 Forbidden
      if (error.response.status === 403) {
        console.error('Access denied. Superadmin role required.');
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// API endpoints
export const adminApi = {
  // Overview
  getOverview: () => api.get('/overview'),
  getFeatures: () => api.get('/features'),
  
  // Tenants
  getTenants: (params) => api.get('/tenants', { params }),
  getTenant: (id) => api.get(`/tenants/${id}`),
  createTenant: (data) => api.post('/tenants', data),
  updateTenant: (id, data) => api.put(`/tenants/${id}`, data),
  deleteTenant: (id) => api.delete(`/tenants/${id}?confirm=true`),
  suspendTenant: (id, reason) => api.post(`/tenants/${id}/suspend`, { reason }),
  activateTenant: (id) => api.post(`/tenants/${id}/activate`),
  
  // Users
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  resetUserPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),
  disableUser2FA: (id) => api.post(`/users/${id}/disable-2fa`),
  bulkUserOperation: (action, userIds, data) => api.post('/users/bulk', { action, userIds, data }),
  
  // Analytics
  getAnalyticsOverview: (params) => api.get('/analytics/overview', { params }),
  getTenantAnalytics: (id, params) => api.get(`/analytics/tenants/${id}`, { params }),
  getUsageAnalytics: (params) => api.get('/analytics/usage', { params }),
  getTrends: (params) => api.get('/analytics/trends', { params }),
  
  // System
  getSystemInfo: () => api.get('/system/info'),
  getSystemHealth: () => api.get('/system/health'),
  getSystemConfig: () => api.get('/system/config'),
  getSystemLogs: (params) => api.get('/system/logs', { params }),
  runMaintenance: (task, data) => api.post('/system/maintenance', { task, ...data }),
  
  // Audit
  getAuditLogs: (params) => api.get('/audit', { params }),
  getAuditStats: (params) => api.get('/audit/stats', { params }),
  exportAuditLogs: (format, startDate, endDate) => 
    api.post('/audit/export', { format, startDate, endDate }),
  cleanupAuditLogs: (retentionDays) => 
    api.delete('/audit/cleanup', { data: { retentionDays } }),
};

export default api;