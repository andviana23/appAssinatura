import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login, logout, type User, type LoginCredentials } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: true,
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${user.nome || user.email}!`,
      });
    },
    onError: (error: any) => {
      console.error("Erro no login:", error);
      // Não fazemos nada aqui para permitir tratamento manual
    }
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Limpar completamente os dados do usuário
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      // Forçar recarga da página para garantir limpeza completa
      window.location.href = "/login";
    },
    onError: () => {
      // Em caso de erro, limpar dados localmente mesmo assim
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    // Validação EXCLUSIVA por campo role do banco
    isAdmin: user?.role === "admin",
    isBarbeiro: user?.role === "barbeiro", 
    isRecepcionista: user?.role === "recepcionista",
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
