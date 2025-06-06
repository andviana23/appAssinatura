import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  email: string;
  role: "admin" | "barbeiro" | "recepcionista";
  nome?: string;
  barbeiroId?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await apiRequest("/api/auth/login", "POST", credentials);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || "Erro no login");
  }
  
  // A API retorna { success: true, user: {...} }
  return data.user || data;
}

export async function logout(): Promise<void> {
  await apiRequest("/api/auth/logout", "POST");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });
    
    if (response.status === 401) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error: any) {
    // Para qualquer erro de rede ou não autorizado, retorna null
    return null;
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}

export function isBarbeiro(user: User | null): boolean {
  return user?.role === "barbeiro";
}
