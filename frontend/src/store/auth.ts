import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../types';

interface AuthStore {
  token: string | null;
  role: UserRole | null;
  userId: number | null;
  fullName: string | null;
  setAuth: (token: string, role: UserRole, userId: number, fullName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      fullName: null,
      setAuth: (token, role, userId, fullName) => {
        localStorage.setItem('token', token);
        set({ token, role, userId, fullName });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, role: null, userId: null, fullName: null });
      },
    }),
    { name: 'auth' }
  )
);
