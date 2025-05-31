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
  LogOut,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: "Barbeiros",
    href: "/barbeiros",
    icon: Users,
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
    name: "Distribuição",
    href: "/distribuicao",
    icon: Calculator,
  },
  {
    name: "Controle de Totais",
    href: "/total-servicos",
    icon: Target,
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="w-72 bg-card shadow-lg border-r border-border/50 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-border/50">
          <div className="h-14 w-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">TB</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Trato de Barbados</h2>
            <p className="text-sm text-muted-foreground font-medium">Sistema de Gestão</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-3">
          {navigation.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/dashboard" && location === "/");
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-4 px-5 py-4 rounded-2xl font-semibold transition-all duration-200 group",
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-[1.02]"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive ? "text-white" : "text-muted-foreground group-hover:text-accent"
                )} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="mt-auto p-6">
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
      </div>
    </div>
  );
}
