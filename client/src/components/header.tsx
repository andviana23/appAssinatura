import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { LogOut, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import logoTratoBarbados from "@/assets/logo-trato-barbados.jpg";

const pageInfo = {
  "/": { title: "Dashboard", subtitle: "Visão geral do sistema" },
  "/dashboard": { title: "Dashboard", subtitle: "Visão geral do sistema" },
  "/barbeiros": { title: "Barbeiros", subtitle: "Gerencie a equipe de barbeiros" },
  "/profissionais": { title: "Profissionais", subtitle: "Gerencie barbeiros e recepcionistas" },
  "/clientes": { title: "Clientes", subtitle: "Clientes com assinaturas ativas" },
  "/servicos": { title: "Serviços", subtitle: "Configure os serviços oferecidos" },
  "/planos": { title: "Planos de Assinatura", subtitle: "Gerencie planos e benefícios" },
  "/comissao": { title: "Comissão", subtitle: "Calcule comissões baseadas em tempo" },
  "/total-servicos": { title: "Controle de Totais", subtitle: "Defina limites mensais de serviços" },
  "/barber": { title: "Meu Dashboard", subtitle: "Seus atendimentos e comissões" },
};

interface HeaderProps {
  showMenuButton?: boolean;
  onMenuToggle?: () => void;
}

export function Header({ showMenuButton = false, onMenuToggle }: HeaderProps = {}) {
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
    <header className="bg-card shadow-lg border-b border-border/50 sticky top-0 z-40 safe-area-inset">
      <div className="mobile-container py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            {/* Botão Menu Mobile */}
            {showMenuButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuToggle}
                className="touch-friendly p-2 lg:hidden rounded-xl"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            
            {/* Logo oficial da Trato de Barbados */}
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-white shadow-lg border border-border/30">
              <img 
                src={logoTratoBarbados} 
                alt="Trato de Barbados" 
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-primary">
                Trato de Barbados
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                {currentPageInfo.title} • {currentPageInfo.subtitle}
              </p>
            </div>
            {/* Título mobile simplificado */}
            <div className="block sm:hidden">
              <h1 className="text-lg font-bold text-primary">
                {currentPageInfo.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="hidden lg:block text-xs sm:text-sm text-muted-foreground capitalize">
              {currentDate}
            </span>
            
            {isAdmin && (
              <Button variant="outline" size="sm" className="hidden md:flex">
                <Bell className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Notificações</span>
              </Button>
            )}

            <ThemeToggle />

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden md:block text-right">
                <p className="font-semibold text-foreground text-sm">
                  {user?.nome || user?.email}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {user?.role === "admin" ? "ADMINISTRADOR" : user?.role === "barbeiro" ? "BARBEIRO" : "RECEPCIONISTA"}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm sm:text-lg">
                  {(user?.nome || user?.email)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="rounded-xl border-2 hover:bg-muted/50 transition-all duration-200 p-2 sm:px-4"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline font-medium">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
