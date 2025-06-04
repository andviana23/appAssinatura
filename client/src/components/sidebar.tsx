import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";
import {
  BarChart3,
  Users,
  Scissors,
  CreditCard,
  Calculator,
  Target,
  UserCheck,
  Calendar,
  FileText,
  LogOut,
  Settings,
  ListOrdered,
  ClipboardList,
  Crown,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: "Profissionais",
    href: "/profissionais",
    icon: Users,
  },
  {
    name: "Clientes",
    href: "/clientes",
    icon: UserCheck,
  },
  {
    name: "Clientes Status",
    href: "/clientes-status",
    icon: ListOrdered,
  },
  {
    name: "Serviços",
    href: "/servicos",
    icon: Scissors,
  },
  {
    name: "Planos",
    href: "/planos",
    icon: CreditCard,
  },
  {
    name: "Gerenciar Assinaturas",
    href: "/gerenciar-assinaturas",
    icon: Crown,
  },
  {
    name: "Agendamento",
    href: "/agendamento",
    icon: Calendar,
  },
  {
    name: "Comissão",
    href: "/comissao",
    icon: Calculator,
  },
  {
    name: "Relatórios",
    href: "/relatorios",
    icon: Target,
  },
  {
    name: "Lista da Vez",
    href: "/lista-da-vez",
    icon: ClipboardList,
  },
];

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, collapsed = false, onClose }: SidebarProps = {}) {
  const [location] = useLocation();
  const { user, logout, isAdmin, isBarbeiro, isRecepcionista } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  
  // Navegação dinâmica baseada no perfil do usuário
  const getNavigationItems = () => {
    if (isAdmin) {
      return navigation;
    }
    
    if (isRecepcionista) {
      return [
        {
          name: "Dashboard",
          href: "/",
          icon: BarChart3,
        },
        {
          name: "Agendamento",
          href: "/agendamento",
          icon: Calendar,
        },
        {
          name: "Clientes",
          href: "/clientes",
          icon: UserCheck,
        },
        {
          name: "Planos",
          href: "/planos",
          icon: CreditCard,
        },
        {
          name: "Lista da Vez",
          href: "/lista-da-vez",
          icon: ListOrdered,
        },
      ];
    }
    
    if (isBarbeiro) {
      return [
        {
          name: "Dashboard",
          href: "/",
          icon: BarChart3,
        },
        {
          name: "Lista da Vez",
          href: "/lista-da-vez",
          icon: ListOrdered,
        },
      ];
    }
    
    return navigation;
  };
  
  const navigationItems = getNavigationItems();

  const sidebarWidth = isCollapsed ? "w-20" : mobile ? "w-80" : "w-72";
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`${sidebarWidth} bg-card shadow-lg border-r border-border/50 flex flex-col ${mobile ? 'h-full' : 'min-h-screen'} transition-all duration-300 relative`}>
      
      {/* Toggle Button - Premium Style */}
      {!mobile && (
        <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} p-4 border-b border-border/50`}>
          <button
            onClick={toggleCollapse}
            className="bg-gradient-to-r from-primary to-primary/90 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      )}

      {/* Logo */}
      <div className={`${isCollapsed ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center mb-6' : 'space-x-4 mb-8'} pb-6 border-b border-border/50`}>
          <div className={`${isCollapsed ? 'h-12 w-12' : 'h-14 w-14'} bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg`}>
            <span className={`text-white font-bold ${isCollapsed ? 'text-lg' : 'text-xl'}`}>TB</span>
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-bold text-primary">Trato de Barbados</h2>
              <p className="text-sm text-muted-foreground font-medium">Sistema de Gestão</p>
            </div>
          )}
          {mobile && onClose && (
            <button 
              onClick={onClose}
              className="ml-auto p-2 hover:bg-muted rounded-xl"
            >
              <span className="sr-only">Fechar menu</span>
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`space-y-1 ${isCollapsed ? 'space-y-3' : 'space-y-2'}`}>
          {navigationItems.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/dashboard" && location === "/");
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-2xl font-semibold transition-all duration-200 group",
                  isCollapsed 
                    ? "justify-center p-5 mx-2" 
                    : "space-x-4 px-5 py-4",
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-[1.02]"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className={cn(
                  isCollapsed ? "h-5 w-5" : "h-6 w-6",
                  "transition-all duration-300",
                  isActive 
                    ? "text-white" 
                    : isCollapsed 
                      ? "text-primary dark:text-white group-hover:text-accent"
                      : "text-muted-foreground group-hover:text-accent"
                )} />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
          
          {/* Configurações - sempre visível */}
          <Link
            href="/configuracoes"
            className={cn(
              "flex items-center rounded-2xl font-semibold transition-all duration-200 group",
              isCollapsed 
                ? "justify-center p-5 mx-2" 
                : "space-x-4 px-5 py-4",
              location === "/configuracoes"
                ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-[1.02]"
            )}
            title={isCollapsed ? "Configurações" : undefined}
          >
            <Settings className={cn(
              isCollapsed ? "h-5 w-5" : "h-6 w-6",
              "transition-all duration-300",
              location === "/configuracoes" 
                ? "text-white" 
                : isCollapsed 
                  ? "text-primary dark:text-white group-hover:text-accent"
                  : "text-muted-foreground group-hover:text-accent"
            )} />
            {!isCollapsed && <span>Configurações</span>}
          </Link>
        </nav>
      </div>

      {/* Theme Toggle and User section */}
      <div className={`mt-auto space-y-4 ${collapsed ? 'p-4' : 'p-6'}`}>
        {/* Theme Toggle */}
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <ThemeToggle />
        </div>
        
        {/* User Section */}
        {collapsed ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 dark:from-primary dark:to-primary/90 rounded-2xl flex items-center justify-center shadow-md border border-border/50">
              <span className="text-primary-foreground font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-all duration-200"
              title="Sair do Sistema"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/80 dark:from-primary dark:to-primary/90 rounded-2xl flex items-center justify-center shadow-md border border-border/50">
                <span className="text-primary-foreground font-bold text-lg">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-card-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  {user?.role === "admin" ? "Administrador" : "Barbeiro"}
                </p>
              </div>
              <button
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-all duration-200"
                title="Sair do Sistema"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
