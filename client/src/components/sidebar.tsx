import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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
    name: "Agendamento",
    href: "/agendamento",
    icon: Calendar,
  },
  {
    name: "Comissão",
    href: "/distribuicao",
    icon: Calculator,
  },
  {
    name: "Relatórios",
    href: "/relatorios",
    icon: Target,
  },
];

interface SidebarProps {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, collapsed = false, onClose }: SidebarProps = {}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const sidebarWidth = collapsed ? "w-20" : mobile ? "w-80" : "w-72";

  return (
    <div className={`${sidebarWidth} bg-card shadow-lg border-r border-border/50 flex flex-col ${mobile ? 'h-full' : 'min-h-screen'}`}>
      {/* Logo */}
      <div className={`${collapsed ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center mb-6' : 'space-x-4 mb-8'} pb-6 border-b border-border/50`}>
          <div className={`${collapsed ? 'h-12 w-12' : 'h-14 w-14'} bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg`}>
            <span className={`text-white font-bold ${collapsed ? 'text-lg' : 'text-xl'}`}>TB</span>
          </div>
          {!collapsed && (
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
        <nav className={`space-y-3 ${collapsed ? 'space-y-2' : ''}`}>
          {navigation.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/dashboard" && location === "/");
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-2xl font-semibold transition-all duration-200 group",
                  collapsed 
                    ? "justify-center p-3 mx-2" 
                    : "space-x-4 px-5 py-4",
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-[1.02]"
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-accent"
                )} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className={`mt-auto ${collapsed ? 'p-4' : 'p-6'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="h-10 w-10 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/5 transition-all duration-200"
              title="Sair do Sistema"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-2xl p-5 border border-border/50">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  {user?.role === "admin" ? "Administrador" : "Barbeiro"}
                </p>
              </div>
              <button
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/5 transition-all duration-200"
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
