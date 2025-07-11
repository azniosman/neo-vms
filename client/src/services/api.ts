import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { setAccessToken, clearAuth } from '../store/slices/authSlice';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState();
    const token = state.auth.accessToken;
    
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;
        
        store.dispatch(setAccessToken(accessToken));
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  login: (credentials: { email: string; password: string; mfaToken?: string }) =>
    api.post('/auth/login', credentials),
  
  logout: () => api.post('/auth/logout'),
  
  refreshToken: () => api.post('/auth/refresh'),
  
  getCurrentUser: () => api.get('/auth/me'),
  
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  
  updateProfile: (profileData: any) => api.put('/auth/profile', profileData),
  
  setupMFA: () => api.post('/auth/setup-mfa'),
  
  verifyMFA: (token: string) => api.post('/auth/verify-mfa', { token }),
  
  disableMFA: (password: string) => api.post('/auth/disable-mfa', { password }),
};

export const visitorsAPI = {
  getVisitors: (params?: any) => api.get('/visitors', { params }),
  
  getVisitor: (id: string) => api.get(`/visitors/${id}`),
  
  createVisitor: (visitorData: any) => api.post('/visitors', visitorData),
  
  updateVisitor: (id: string, visitorData: any) => api.put(`/visitors/${id}`, visitorData),
  
  uploadPhoto: (id: string, photo: File) => {
    const formData = new FormData();
    formData.append('photo', photo);
    return api.post(`/visitors/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  blacklistVisitor: (id: string, reason: string) =>
    api.post(`/visitors/${id}/blacklist`, { reason }),
  
  removeFromBlacklist: (id: string) => api.delete(`/visitors/${id}/blacklist`),
};

export const visitsAPI = {
  getVisits: (params?: any) => api.get('/visits', { params }),
  
  getVisit: (id: string) => api.get(`/visits/${id}`),
  
  createVisit: (visitData: any) => api.post('/visits', visitData),
  
  updateVisit: (id: string, visitData: any) => api.put(`/visits/${id}`, visitData),
  
  checkIn: (id: string) => api.post(`/visits/${id}/checkin`),
  
  checkOut: (id: string, data?: any) => api.post(`/visits/${id}/checkout`, data),
  
  cancelVisit: (id: string, reason: string) => api.delete(`/visits/${id}`, { data: { reason } }),
  
  getActiveVisits: () => api.get('/visits/active'),
  
  getOccupancy: () => api.get('/visits/occupancy'),
  
  getOverdueVisits: () => api.get('/visits/overdue'),
};

export const usersAPI = {
  getUsers: (params?: any) => api.get('/users', { params }),
  
  getUser: (id: string) => api.get(`/users/${id}`),
  
  createUser: (userData: any) => api.post('/users', userData),
  
  updateUser: (id: string, userData: any) => api.put(`/users/${id}`, userData),
  
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  
  resetUserPassword: (id: string) => api.post(`/users/${id}/reset-password`),
  
  toggleUserStatus: (id: string) => api.post(`/users/${id}/toggle-status`),
};

export const reportsAPI = {
  getVisitorReport: (params?: any) => api.get('/reports/visitors', { params }),
  
  getVisitReport: (params?: any) => api.get('/reports/visits', { params }),
  
  getSecurityReport: (params?: any) => api.get('/reports/security', { params }),
  
  getAuditReport: (params?: any) => api.get('/reports/audit', { params }),
  
  exportReport: (type: string, params?: any) =>
    api.get(`/reports/${type}/export`, { params, responseType: 'blob' }),
};

export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  
  updateSettings: (settings: any) => api.put('/settings', settings),
  
  getPublicSettings: () => api.get('/settings/public'),
  
  testEmailConfig: () => api.post('/settings/test-email'),
  
  testSMSConfig: () => api.post('/settings/test-sms'),
};

export const emergencyAPI = {
  sendAlert: (alertData: any) => api.post('/emergency/alert', alertData),
  
  getEvacuationList: () => api.get('/emergency/evacuation-list'),
  
  markEvacuated: (visitId: string, evacuationData: any) =>
    api.post(`/emergency/evacuate/${visitId}`, evacuationData),
  
  getEmergencyContacts: () => api.get('/emergency/contacts'),
  
  updateEmergencyContacts: (contacts: any) => api.put('/emergency/contacts', contacts),
};

export const notificationsAPI = {
  getNotifications: (params?: any) => api.get('/notifications', { params }),
  
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  
  deleteNotification: (id: string) => api.delete(`/notifications/${id}`),
  
  getNotificationSettings: () => api.get('/notifications/settings'),
  
  updateNotificationSettings: (settings: any) => api.put('/notifications/settings', settings),
};

export const analyticsAPI = {
  getDashboardStats: () => api.get('/analytics/dashboard'),
  
  getVisitorStats: (params?: any) => api.get('/analytics/visitors', { params }),
  
  getVisitStats: (params?: any) => api.get('/analytics/visits', { params }),
  
  getOccupancyStats: (params?: any) => api.get('/analytics/occupancy', { params }),
  
  getSecurityStats: (params?: any) => api.get('/analytics/security', { params }),
};

export const publicAPI = {
  preRegister: (visitorData: any) => api.post('/public/pre-register', visitorData),
  
  checkIn: (qrCode: string) => api.post('/public/checkin', { qrCode }),
  
  getVisitDetails: (qrCode: string) => api.get(`/public/visit/${qrCode}`),
  
  submitFeedback: (visitId: string, feedback: any) =>
    api.post(`/public/feedback/${visitId}`, feedback),
};

export default api;