import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const pageInfo = {
  "/": { title: "Dashboard", subtitle: "Visão geral do sistema" },
  "/dashboard": { title: "Dashboard", subtitle: "Visão geral do sistema" },
  "/barbeiros": { title: "Barbeiros", subtitle: "Gerencie a equipe de barbeiros" },
  "/servicos": { title: "Serviços", subtitle: "Configure os serviços oferecidos" },
  "/planos": { title: "Planos de Assinatura", subtitle: "Gerencie planos e benefícios" },
  "/distribuicao": { title: "Distribuição de Pontos", subtitle: "Calcule comissões baseadas em tempo" },
  "/barber": { title: "Meu Dashboard", subtitle: "Seus atendimentos e comissões" },
};

export function Header() {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  
  const currentPageInfo = pageInfo[location as keyof typeof pageInfo] || 
    { title: "Página", subtitle: "Sistema de Gestão" };

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long", 
    day: "numeric",
  });

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="px-24 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {currentPageInfo.title}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentPageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground capitalize">
              {currentDate}
            </span>
            
            {isAdmin && (
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notificações
              </Button>
            )}

            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary rounded-2xl flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="font-medium text-foreground">{user?.email}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.role === "admin" ? "Administrador" : "Barbeiro"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
