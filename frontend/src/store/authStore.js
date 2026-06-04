import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  })(),
  token: localStorage.getItem('token') || null,
  
  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    set({ user: userData, token });
  },
  
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  
  isAdmin: () => {
    const { user } = useAuthStore.getState();
    return user?.role === 'ADMIN';
  }
}));

export default useAuthStore;
