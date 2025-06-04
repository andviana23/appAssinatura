import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Clock, CreditCard, Plus } from "lucide-react";
import { Link } from "wouter";

export default function DashboardRecepcionista() {
  // Buscar dados para métricas básicas
  const { data: clientes } = useQuery({
    queryKey: ["/api/clientes/unified"],
  });

  const { data: agendamentos } = useQuery({
    queryKey: ["/api/agendamentos"],
  });

  const clientesAtivos = clientes?.filter((c: any) => c.ativo)?.length || 0;
  const agendamentosHoje = agendamentos?.filter((a: any) => {
    const hoje = new Date().toDateString();
    return new Date(a.dataHora).toDateString() === hoje;
  })?.length || 0;

  const proximosAtendimentos = agendamentos?.filter((a: any) => {
    const agora = new Date();
    const agendamento = new Date(a.dataHora);
    return agendamento > agora;
  })?.slice(0, 3) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header do Dashboard */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard Recepcionista</h1>
        <p className="text-muted-foreground">Bem-vinda! Aqui estão as informações principais do dia.</p>
      </div>

      {/* Atalhos Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <Link href="/agendamentos">
              <Button className="w-full h-16 text-lg" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Novo Agendamento
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <Link href="/lista-da-vez">
              <Button variant="outline" className="w-full h-16 text-lg" size="lg">
                <Clock className="mr-2 h-5 w-5" />
                Ver Lista da Vez
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <Link href="/clientes">
              <Button variant="outline" className="w-full h-16 text-lg" size="lg">
                <Users className="mr-2 h-5 w-5" />
                Gerenciar Clientes
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <Link href="/planos">
              <Button variant="outline" className="w-full h-16 text-lg" size="lg">
                <CreditCard className="mr-2 h-5 w-5" />
                Ver Planos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Básicas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">
              Total de clientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendamentosHoje}</div>
            <p className="text-xs text-muted-foreground">
              Atendimentos programados para hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Atendimentos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proximosAtendimentos.length}</div>
            <p className="text-xs text-muted-foreground">
              Agendamentos futuros confirmados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Próximos Atendimentos */}
      {proximosAtendimentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proximosAtendimentos.map((agendamento: any) => (
                <div key={agendamento.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{agendamento.nomeCliente}</p>
                    <p className="text-sm text-muted-foreground">
                      {agendamento.servico} • {agendamento.profissional}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {new Date(agendamento.dataHora).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(agendamento.dataHora).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/agendamentos">
                <Button variant="outline" className="w-full">
                  Ver Todos os Agendamentos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}