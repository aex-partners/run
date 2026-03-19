import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthContext.Provider");
  }
  return ctx;
}
