import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Role } from "./types";

interface AuthState {
  token: string | null;
  role: Role | null;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, role: Role, userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwt(token: string): { role: Role; sub: string } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { role: payload.role, sub: payload.sub };
  } catch {
    return null;
  }
}

function loadInitialState(): AuthState {
  const token = localStorage.getItem("reflex_token");
  if (!token) return { token: null, role: null, userId: null };
  const parsed = parseJwt(token);
  if (!parsed) return { token: null, role: null, userId: null };
  return { token, role: parsed.role, userId: Number(parsed.sub) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState);

  const login = useCallback((token: string, role: Role, userId: number) => {
    localStorage.setItem("reflex_token", token);
    setState({ token, role, userId });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("reflex_token");
    setState({ token: null, role: null, userId: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
