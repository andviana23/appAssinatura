import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Scissors, 
  DollarSign, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  Eye,
  Calendar,
  Timer,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function BarbeiroDashboardReformulado() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRelatorio, setShowRelatorio] = useState(false);
  
  const hoje = new Date();
  const mesAtual = format(hoje, "MMMM yyyy", { locale: ptBR });
  const dataFormatada = format(selectedDate, "yyyy-MM-dd");
  
  // Buscar estatísticas do mês atual
  const { data: estatisticasMes } = useQuery({
    queryKey: ["/api/barbeiro/estatisticas-mes", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/barbeiro/estatisticas-mes`);
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');
      return response.json();
    },
  });

  // Buscar dados da agenda do dia selecionado
  const { data: agendaDia } = useQuery({
    queryKey: ["/api/barbeiro/agenda", user?.id, dataFormatada],
    queryFn: async () => {
      const response = await fetch(`/api/barbeiro/agenda?data=${dataFormatada}`);
      if (!response.ok) throw new Error('Erro ao carregar agenda');
      return response.json();
    },
  });

  // Buscar dados da lista da vez
  const { data: listaDaVez } = useQuery({
    queryKey: ["/api/barbeiro/lista-da-vez", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/barbeiro/lista-da-vez`);
      if (!response.ok) throw new Error('Erro ao carregar lista da vez');
      return response.json();
    },
  });

  // Buscar comissão do mês
  const { data: comissaoMes } = useQuery({
    queryKey: ["/api/barbeiro/comissao-mes", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/barbeiro/comissao-mes`);
      if (!response.ok) throw new Error('Erro ao carregar comissão');
      return response.json();
    },
  });

  // Navegação de datas
  const navegarData = (direcao: 'anterior' | 'proximo') => {
    if (direcao === 'anterior') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  // Modal de detalhes dos serviços
  const ModalDetalhesServicos = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="ml-auto">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes dos Serviços - {mesAtual}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {estatisticasMes?.servicosPorTipo?.map((servico: any, index: number) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">{servico.nome}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{servico.quantidade} serviços</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{servico.tempoTotal}min</p>
                <p className="text-xs text-gray-500">tempo total</p>
              </div>
            </div>
          )) || (
            <p className="text-center text-gray-500">Nenhum serviço finalizado este mês</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // Modal do relatório pessoal
  const ModalRelatorio = () => (
    <Dialog open={showRelatorio} onOpenChange={setShowRelatorio}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório Pessoal - {mesAtual}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tempo Médio por Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasMes?.tempoMedioPorServico || 0}min</div>
              <p className="text-xs text-gray-600">média mensal</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Média de Atendimentos/Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasMes?.mediateendimentosPorDia || 0}</div>
              <p className="text-xs text-gray-600">atendimentos por dia</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Produtividade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasMes?.produtividade || 0}%</div>
              <p className="text-xs text-gray-600">eficiência mensal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Crescimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{estatisticasMes?.crescimentoMensal || 0}%
              </div>
              <p className="text-xs text-gray-600">vs mês anterior</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-background dark:bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Olá, {user?.nome?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            Aqui está seu painel pessoal de {mesAtual}
          </p>
        </div>

        {/* Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card: Serviços Finalizados */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serviços Finalizados</CardTitle>
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <ModalDetalhesServicos />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticasMes?.servicosFinalizados || 0}</div>
              <p className="text-xs text-muted-foreground">este mês</p>
            </CardContent>
          </Card>

          {/* Card: Tempo Trabalhado */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Trabalhado</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor((estatisticasMes?.tempoTrabalhadoMinutos || 0) / 60)}h{" "}
                {(estatisticasMes?.tempoTrabalhadoMinutos || 0) % 60}min
              </div>
              <p className="text-xs text-muted-foreground">este mês</p>
            </CardContent>
          </Card>

          {/* Card: Comissão do Mês */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {(comissaoMes?.valorComissao || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">40% dos serviços</p>
            </CardContent>
          </Card>

          {/* Card: Lista da Vez */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lista da Vez</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-lg font-bold">
                    Sua posição na Lista da Vez: {listaDaVez?.posicaoAtual || 0}º
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Atendimentos: {listaDaVez?.atendimentos || 0}</span>
                    <span>Passou: {listaDaVez?.passouvez || 0}x</span>
                  </div>
                </div>
                <Button 
                  onClick={() => window.location.href = "/barbeiro/agenda"}
                  className="w-full bg-[#365e78] hover:bg-[#2a4a5e] text-white text-sm py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Ver Agenda
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Botão para Relatório Detalhado */}
        <div className="flex justify-center">
          <Button 
            onClick={() => setShowRelatorio(true)}
            className="bg-[#365e78] hover:bg-[#2a4a61] text-white px-8 py-3"
            size="lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            Ver Relatório Detalhado
          </Button>
        </div>

        {/* Modais */}
        <ModalRelatorio />
        
      </div>
    </div>
  );
}