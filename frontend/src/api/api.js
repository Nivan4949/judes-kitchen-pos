import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 25000 // Extended for Vercel + WhatsApp API delivery
});

// Request interceptor to add the JWT token and Device ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    // Simple Device ID Generation
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      });
      localStorage.setItem('deviceId', deviceId);
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (deviceId) {
      config.headers['x-device-id'] = deviceId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration and transient errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401) {
      // Attempt a single silent retry for transient / cold-start 401s
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        console.warn('Transient 401 detected. Retrying request once in 1000ms...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return api(originalRequest);
      }
      
      // If retry failed, or skipAuthRedirect is active, do not force logout
      if (originalRequest?.skipAuthRedirect) {
        console.warn('Unauthorized background request detected (skipAuthRedirect). Preventing global logout.');
        return Promise.reject(error);
      }
      
      // Avoid redirecting if already on login page
      if (window.location.pathname !== '/login') {
        console.error('Session expired or unauthorized. Clearing session and redirecting to login...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Use replace instead of href to avoid back button issues
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
