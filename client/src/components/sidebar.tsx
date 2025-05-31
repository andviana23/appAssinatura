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
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/dashboard" && location === "/");
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User section */}
      <div className="mt-auto p-24">
        <div className="bg-accent rounded-2xl p-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.role === "admin" ? "Administrador" : "Barbeiro"}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
