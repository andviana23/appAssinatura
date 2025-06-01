import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  Home, 
  Calendar, 
  List, 
  Users, 
  CreditCard, 
  LogOut,
  Plus,
  DollarSign,
  Clock,
  UserCheck
} from "lucide-react";

export default function RecepcionistaDashboard() {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hoje = new Date();

  // Buscar métricas do dashboard
  const { data: metrics } = useQuery({
    queryKey: ["/api/clientes/unified"]
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-xl transition-all duration-300 flex flex-col`}>
        {/* Header do Sidebar */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5 text-[#1e3a8a]" />
            </button>
            {sidebarOpen && (
              <div>
                <h2 className="font-bold text-[#1e3a8a]">Recepção</h2>
                <p className="text-xs text-gray-500">Trato de Barbados</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/recepcionista-dashboard">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1e3a8a]/10 text-[#1e3a8a] transition-colors">
              <Home className="h-5 w-5" />
              {sidebarOpen && <span className="font-medium">Dashboard</span>}
            </div>
          </Link>
          
          <Link href="/agendamento">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1e3a8a]/10 text-[#1e3a8a] transition-colors">
              <Calendar className="h-5 w-5" />
              {sidebarOpen && <span className="font-medium">Agenda</span>}
            </div>
          </Link>
          
          <Link href="/lista-da-vez">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1e3a8a]/10 text-[#1e3a8a] transition-colors">
              <List className="h-5 w-5" />
              {sidebarOpen && <span className="font-medium">Lista da Vez</span>}
            </div>
          </Link>
          
          <Link href="/clientes">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1e3a8a]/10 text-[#1e3a8a] transition-colors">
              <Users className="h-5 w-5" />
              {sidebarOpen && <span className="font-medium">Clientes</span>}
            </div>
          </Link>
          
          <Link href="/planos">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1e3a8a]/10 text-[#1e3a8a] transition-colors">
              <CreditCard className="h-5 w-5" />
              {sidebarOpen && <span className="font-medium">Planos</span>}
            </div>
          </Link>
        </nav>

        {/* Footer do Sidebar */}
        <div className="p-4 border-t">
          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
              } catch (error) {
                console.error('Erro no logout:', error);
                window.location.href = '/';
              }
            }}
            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span className="font-medium">Sair</span>}
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-2xl p-6 mb-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard Recepção</h1>
              <p className="text-blue-100">
                {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/agendamento">
                <Button className="bg-white text-[#1e3a8a] hover:bg-blue-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Agendamento
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Clientes Ativos
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics?.totalActiveClients || 0}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Receita Assinaturas
                  </p>
                  <p className="text-2xl font-bold">
                    R$ {metrics?.totalSubscriptionRevenue?.toFixed(2) || '0,00'}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Agendamentos Hoje
                  </p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Próximo Atendimento
                  </p>
                  <p className="text-2xl font-bold">--:--</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Gestão de Agenda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Visualize e gerencie os agendamentos dos barbeiros
              </p>
              <Link href="/agendamento">
                <Button className="w-full">
                  Acessar Agenda
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Lista da Vez
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Controle a ordem de atendimento dos clientes
              </p>
              <Link href="/lista-da-vez">
                <Button className="w-full">
                  Ver Lista
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Gerencie o cadastro e assinaturas dos clientes
              </p>
              <Link href="/clientes">
                <Button className="w-full">
                  Gerenciar Clientes
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Planos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Visualize os planos de assinatura disponíveis
              </p>
              <Link href="/planos">
                <Button className="w-full">
                  Ver Planos
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Novo Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Crie um novo agendamento rapidamente
              </p>
              <Link href="/agendamento">
                <Button className="w-full bg-[#1e3a8a] hover:bg-[#1e40af]">
                  Agendar Agora
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}