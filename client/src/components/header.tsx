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
    <header className="bg-card shadow-lg border-b border-border/50">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo da Trato de Barbados */}
            <div className="h-14 w-14 bg-gradient-to-br from-primary via-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">TB</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                Trato de Barbados
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                {currentPageInfo.title} • {currentPageInfo.subtitle}
              </p>
            </div>
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

            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <p className="font-semibold text-foreground">{user?.email}</p>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">
                  {user?.role === "admin" ? "Administrador" : "Barbeiro"}
                </p>
              </div>
              <div className="h-12 w-12 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="rounded-xl border-2 hover:bg-muted/50 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline font-medium">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
