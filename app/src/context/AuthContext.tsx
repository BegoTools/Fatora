import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import type { RoleDefinition, PermissionModule, PermissionAction } from '@/types/permissions';
import * as authService from '@/services/auth';
import type { AuthResult } from '@/services/auth';
import { getRoles, roleCan } from '@/services/roles';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  hasAccounts: boolean;
  roles: RoleDefinition[];
  currentRole: RoleDefinition | undefined;
  isOwner: boolean;
  can: (module: PermissionModule, action?: PermissionAction) => boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  reloadRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccounts, setHasAccounts] = useState(false);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);

  const reloadRoles = useCallback(async () => {
    setRoles(await getRoles());
  }, []);

  const refresh = useCallback(async () => {
    const [current, any] = await Promise.all([
      authService.getCurrentUser(),
      authService.hasAnyAccount(),
    ]);
    setUser(current);
    setHasAccounts(any);
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refresh(), reloadRoles()]);
      setLoading(false);
    })();
  }, [refresh, reloadRoles]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.ok && result.user) {
      setUser(result.user);
      setHasAccounts(true);
      await reloadRoles();
    }
    return result;
  }, [reloadRoles]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await authService.register(name, email, password);
    if (result.ok && result.user) {
      setUser(result.user);
      setHasAccounts(true);
      await reloadRoles();
    }
    return result;
  }, [reloadRoles]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const currentRole = user ? roles.find(r => r.id === user.role) : undefined;
  const isOwner = user?.role === 'owner';

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction = 'view') => {
      if (!user) return false;
      if (user.role === 'owner') return true;
      const role = roles.find(r => r.id === user.role);
      return roleCan(role, module, action);
    },
    [user, roles],
  );

  const value: AuthContextValue = {
    user,
    loading,
    hasAccounts,
    roles,
    currentRole,
    isOwner,
    can,
    login,
    register,
    logout,
    refresh,
    reloadRoles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
