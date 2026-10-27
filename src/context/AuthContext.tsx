import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: 'data_entry' | 'viewer';
  }) => Promise<void>;
  updateProfile: (data: { full_name: string; avatar_url?: string | null }) => Promise<void>;
  changePassword: (data: { current_password: string; new_password: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('sandtrack_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    api.getMe()
      .then(res => setUser(res.user))
      .catch(() => {
        localStorage.removeItem('sandtrack_token');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    setUser(res.user);
  };

  const register = async (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: 'data_entry' | 'viewer';
  }) => {
    const res = await api.register(data);
    setUser(res.user);
  };

  const updateProfile = async (data: { full_name: string; avatar_url?: string | null }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  const changePassword = async (data: { current_password: string; new_password: string }) => {
    await api.changePassword(data);
  };

  const logout = async () => {
    await api.logout();
    localStorage.removeItem('sandtrack_token');
    setUser(null);
  };

  const canEdit = user?.role === 'data_entry' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const isViewer = user?.role === 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        canEdit,
        isAdmin,
        isViewer,
        login,
        register,
        updateProfile,
        changePassword,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
