import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle } from "lucide-react";
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

  // Buscar todos os agendamentos para calcular finalizados hoje
  const { data: todosAgendamentos } = useQuery({
    queryKey: ["/api/agendamentos", "todos"],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?data=${hoje}`);
      if (!response.ok) throw new Error('Erro ao carregar todos os agendamentos');
      return response.json();
    }
  });

  // Calcular métricas
  const clientes = clientesData?.data || [];
  const clientesAssinaturaAtivos = clientes.filter((c: any) => c.statusAssinatura === 'ATIVO').length;
  
  // Total de agendamentos feitos hoje (criados hoje, independente do status)
  const todosAgendamentosArray = Array.isArray(todosAgendamentos) ? todosAgendamentos : [];
  const agendamentosFeitosHoje = todosAgendamentosArray.length;
  
  // Total de agendamentos finalizados hoje
  const agendamentosFinalizadosHoje = todosAgendamentosArray.filter((ag: any) => ag.status === 'FINALIZADO').length;

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
            <CardTitle className="text-sm font-medium">Clientes Assinatura Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAssinaturaAtivos}</div>
            <p className="text-xs text-muted-foreground">
              Com assinatura ativa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agendamentos Feitos Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendamentosFeitosHoje}</div>
            <p className="text-xs text-muted-foreground">
              Agendamentos criados hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agendamentos Finalizados Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agendamentosFinalizadosHoje}</div>
            <p className="text-xs text-muted-foreground">
              Finalizados hoje
            </p>
          </CardContent>
        </Card>

      </div>


    </div>
  );
}