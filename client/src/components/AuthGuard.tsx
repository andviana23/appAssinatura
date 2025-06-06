import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Aguardar o carregamento da autenticação
    if (isLoading) return;

    // Se não autenticado e não estiver na página de login, redirecionar
    if (!isAuthenticated && location !== "/login") {
      setLocation("/login");
      return;
    }

    // Se autenticado e estiver na página de login, redirecionar para dashboard
    if (isAuthenticated && location === "/login") {
      setLocation("/");
      return;
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}