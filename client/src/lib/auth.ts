import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  email: string;
  role: "admin" | "barbeiro";
  barbeiroId?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await apiRequest("POST", "/api/auth/login", credentials);
  return response.json();
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiRequest("GET", "/api/auth/me");
    return response.json();
  } catch (error) {
    // Se não estiver autenticado, retorna null
    return null;
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}

export function isBarbeiro(user: User | null): boolean {
  return user?.role === "barbeiro";
}
