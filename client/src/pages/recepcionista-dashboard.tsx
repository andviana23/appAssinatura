import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, CreditCard, DollarSign, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function RecepcionistaDashboard() {
  // Buscar dados do faturamento do dia
  const { data: faturamentoDiario, isLoading: faturamentoLoading } = useQuery({
    queryKey: ["/api/asaas/faturamento-diario"],
    queryFn: () => apiRequest("/api/asaas/faturamento-diario"),
  });

  // Buscar estatísticas de clientes
  const { data: clientesStats, isLoading: clientesLoading } = useQuery({
    queryKey: ["/api/clientes/unified-stats"],
    queryFn: () => apiRequest("/api/clientes/unified-stats"),
  });

  // Buscar agendamentos do dia
  const { data: agendamentos, isLoading: agendamentosLoading } = useQuery({
    queryKey: ["/api/agendamentos"],
    queryFn: () => apiRequest("/api/agendamentos"),
  });

  const hoje = new Date();
  const faturamentoHoje = Array.isArray(faturamentoDiario) 
    ? faturamentoDiario.find(item => item.date === format(hoje, "yyyy-MM-dd"))?.value || 0
    : 0;

  const agendamentosHoje = Array.isArray(agendamentos)
    ? agendamentos.filter(agendamento => {
        const dataAgendamento = format(new Date(agendamento.dataHora), "yyyy-MM-dd");
        return dataAgendamento === format(hoje, "yyyy-MM-dd");
      }).length
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#365e78]">Recepção</h1>
          <p className="text-gray-600">
            {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Link href="/agendamento">
          <Button className="bg-[#365e78] hover:bg-[#2d4f63] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </Link>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Faturamento Hoje
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {faturamentoLoading ? "..." : `R$ ${faturamentoHoje.toFixed(2)}`}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <DollarSign className="inline h-3 w-3 mr-1" />
                  Vendas do dia
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
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
                <p className="text-2xl font-bold text-foreground">
                  {agendamentosLoading ? "..." : agendamentosHoje}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Atendimentos
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Clientes Ativos
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {clientesLoading ? "..." : (clientesStats?.totalActiveClients || 0)}
                </p>
                <p className="text-sm text-[#365e78] mt-1">
                  <Users className="inline h-3 w-3 mr-1" />
                  Com assinatura
                </p>
              </div>
              <div className="h-12 w-12 bg-[#365e78]/10 rounded-2xl flex items-center justify-center">
                <Users className="h-6 w-6 text-[#365e78]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Receita Mensal
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {clientesLoading ? "..." : `R$ ${(clientesStats?.totalSubscriptionRevenue || 0).toFixed(2)}`}
                </p>
                <p className="text-sm text-[#d3b791] mt-1">
                  <CreditCard className="inline h-3 w-3 mr-1" />
                  Assinaturas
                </p>
              </div>
              <div className="h-12 w-12 bg-[#d3b791]/20 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-[#d3b791]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/agendamento">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#365e78]">
                <Calendar className="h-6 w-6" />
                Agenda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Visualizar e gerenciar agendamentos dos clientes
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clientes">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#365e78]">
                <Users className="h-6 w-6" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Gerenciar informações e assinaturas dos clientes
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/planos">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[#365e78]">
                <CreditCard className="h-6 w-6" />
                Planos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Visualizar e oferecer planos de assinatura
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Próximos Agendamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-[#365e78]">
            <Clock className="h-6 w-6" />
            Próximos Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agendamentosLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : Array.isArray(agendamentos) && agendamentos.length > 0 ? (
            <div className="space-y-3">
              {agendamentos
                .filter(agendamento => new Date(agendamento.dataHora) >= hoje)
                .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
                .slice(0, 5)
                .map((agendamento: any) => (
                  <div
                    key={agendamento.id}
                    className="flex items-center justify-between p-3 rounded-xl border-l-4 border-[#365e78] bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {agendamento.cliente?.nome || 'Cliente não informado'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {agendamento.servico?.nome || 'Serviço não informado'} - {agendamento.barbeiro?.nome || 'Barbeiro não informado'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#365e78]">
                        {format(new Date(agendamento.dataHora), "HH:mm")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(agendamento.dataHora), "dd/MM", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>Nenhum agendamento encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}