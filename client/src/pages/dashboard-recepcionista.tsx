import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Clock, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardRecepcionista() {
  const hoje = new Date().toISOString().split('T')[0];
  
  // Buscar todos os clientes
  const { data: clientesData } = useQuery({
    queryKey: ["/api/clientes"],
    queryFn: async () => {
      const response = await fetch('/api/clientes');
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    }
  });

  // Buscar agendamentos de hoje
  const { data: agendamentosHoje } = useQuery({
    queryKey: ["/api/agendamentos", hoje],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?data=${hoje}`);
      if (!response.ok) throw new Error('Erro ao carregar agendamentos');
      const data = await response.json();
      // Filtrar apenas agendamentos no horário válido (08:00-20:00)
      return Array.isArray(data) ? data.filter((ag: any) => {
        const hour = new Date(ag.dataHora).getHours();
        return hour >= 8 && hour <= 20;
      }) : [];
    }
  });

  // Buscar agendamentos futuros
  const { data: agendamentosFuturos } = useQuery({
    queryKey: ["/api/agendamentos/futuros"],
    queryFn: async () => {
      const response = await fetch('/api/agendamentos');
      if (!response.ok) throw new Error('Erro ao carregar agendamentos futuros');
      const data = await response.json();
      const agora = new Date();
      // Filtrar apenas agendamentos futuros no horário válido (08:00-20:00)
      return Array.isArray(data) ? data.filter((ag: any) => {
        const agendamentoDate = new Date(ag.dataHora);
        const hour = agendamentoDate.getHours();
        return agendamentoDate > agora && hour >= 8 && hour <= 20;
      }) : [];
    }
  });

  // Calcular métricas
  const clientes = clientesData?.data || [];
  const clientesAtivos = clientes.filter((c: any) => c.statusAssinatura === 'ATIVO').length;
  const totalClientes = clientes.length;
  const agendamentosHojeCount = Array.isArray(agendamentosHoje) ? agendamentosHoje.length : 0;
  const proximosAgendamentosCount = Array.isArray(agendamentosFuturos) ? agendamentosFuturos.length : 0;
  const proximosAtendimentos = Array.isArray(agendamentosHoje) ? agendamentosHoje.slice(0, 5) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header do Dashboard */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard Recepcionista</h1>
        <p className="text-muted-foreground">Bem-vinda! Aqui estão as informações principais do dia.</p>
      </div>

      {/* Métricas Básicas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">
              Com assinatura ativa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClientes}</div>
            <p className="text-xs text-muted-foreground">
              Clientes cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendamentosHojeCount}</div>
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
            <div className="text-2xl font-bold">{proximosAgendamentosCount}</div>
            <p className="text-xs text-muted-foreground">
              Agendamentos futuros confirmados
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Lista de Próximos Atendimentos */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos Atendimentos de Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {proximosAtendimentos.length > 0 ? (
            <div className="space-y-3">
              {proximosAtendimentos.map((agendamento: any) => (
                <div key={agendamento.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{agendamento.nomeCliente || 'Cliente'}</p>
                    <p className="text-sm text-muted-foreground">
                      {agendamento.servicoNome || 'Serviço'} • {agendamento.barbeiroNome || 'Profissional'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {agendamento.dataHora ? format(new Date(agendamento.dataHora), 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {agendamento.dataHora ? format(new Date(agendamento.dataHora), 'HH:mm') : 'Horário'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum agendamento encontrado para hoje</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}