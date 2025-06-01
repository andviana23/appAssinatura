import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  email: string;
  role: "admin" | "barbeiro" | "recepcionista";
  barbeiroId?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await apiRequest("/api/auth/login", "POST", credentials);
  return response.json();
}

export async function logout(): Promise<void> {
  await apiRequest("/api/auth/logout", "POST");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiRequest("/api/auth/me", "GET");
    if (!response.ok) {
      throw new Error('Unauthorized');
    }
    return response.json();
  } catch (error: any) {
    // Se não estiver autenticado, retorna null
    if (error.message === 'Unauthorized' || error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}

export function isBarbeiro(user: User | null): boolean {
  return user?.role === "barbeiro";
}
