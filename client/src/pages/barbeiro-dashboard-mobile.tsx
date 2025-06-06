import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingUp,
  Eye,
  Activity,
  Target,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interfaces
interface EstatisticasMes {
  servicosFinalizados: number;
  tempoTrabalhadoMinutos: number;
  tempoMedioPorServico: number;
  servicosPorTipo?: Array<{
    nome: string;
    quantidade: number;
    tempoTotal: number;
  }>;
}

interface ComissaoMes {
  valorComissao: number;
  totalServicos: number;
  percentualComissao: number;
}

interface ListaDaVez {
  posicaoAtual: number;
  atendimentos: number;
  passouvez: number;
}

export default function BarbeiroDashboardMobile() {
  const { user } = useAuth();
  
  // Queries para buscar dados
  const { data: estatisticasMes, isLoading: loadingEstatisticas } = useQuery({
    queryKey: ["/api/barbeiro/estatisticas-mes"],
    queryFn: async () => {
      const response = await fetch("/api/barbeiro/estatisticas-mes");
      if (!response.ok) throw new Error("Erro ao buscar estatísticas");
      return response.json();
    },
  });

  const { data: comissaoMes, isLoading: loadingComissao } = useQuery({
    queryKey: ["/api/barbeiro/comissao-mes"],
    queryFn: async () => {
      const response = await fetch("/api/barbeiro/comissao-mes");
      if (!response.ok) throw new Error("Erro ao buscar comissão");
      return response.json();
    },
  });

  const { data: listaDaVez, isLoading: loadingLista } = useQuery({
    queryKey: ["/api/barbeiro/lista-da-vez"],
    queryFn: async () => {
      const response = await fetch("/api/barbeiro/lista-da-vez");
      if (!response.ok) throw new Error("Erro ao buscar lista da vez");
      return response.json();
    },
  });

  const mesAtual = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const isLoading = loadingEstatisticas || loadingComissao || loadingLista;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-3">
        <div className="max-w-md mx-auto space-y-4">
          <div className="animate-pulse">
            <div className="h-20 bg-gray-800 rounded-xl mb-4"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-3">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Header Mobile-First */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {(user?.nome || user?.email || 'B')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white">
                Dashboard do Barbeiro
              </h1>
              <p className="text-gray-400 text-sm">
                {user?.nome || user?.email}
              </p>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Período</p>
                <p className="text-white font-semibold capitalize">{mesAtual}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-300 text-sm">Status</p>
                <Badge className="bg-green-600 text-white">Ativo</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Métricas - Grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Serviços Finalizados */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <Badge className="bg-green-600 text-white text-xs">
                +{estatisticasMes?.servicosFinalizados || 0}
              </Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {estatisticasMes?.servicosFinalizados || 0}
            </div>
            <div className="text-xs text-gray-400">Serviços este mês</div>
          </div>

          {/* Tempo Trabalhado */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-blue-400" />
              <Badge className="bg-blue-600 text-white text-xs">
                {Math.floor((estatisticasMes?.tempoTrabalhadoMinutos || 0) / 60)}h
              </Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {Math.floor((estatisticasMes?.tempoTrabalhadoMinutos || 0) / 60)}h{" "}
              {(estatisticasMes?.tempoTrabalhadoMinutos || 0) % 60}min
            </div>
            <div className="text-xs text-gray-400">Tempo trabalhado</div>
          </div>

          {/* Comissão */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              <Badge className="bg-green-600 text-white text-xs">40%</Badge>
            </div>
            <div className="text-2xl font-bold text-green-400 mb-1">
              R$ {(comissaoMes?.valorComissao || 0).toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">Comissão do mês</div>
          </div>

          {/* Posição na Lista */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-purple-400" />
              <Badge className="bg-purple-600 text-white text-xs">
                {listaDaVez?.posicaoAtual || 0}º
              </Badge>
            </div>
            <div className="text-2xl font-bold text-purple-400 mb-1">
              {listaDaVez?.posicaoAtual || 0}º
            </div>
            <div className="text-xs text-gray-400">Posição na fila</div>
          </div>
        </div>

        {/* Card da Lista da Vez - Detalhado */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Lista da Vez</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Sua Posição Atual</p>
                <p className="text-gray-400 text-sm">Na fila de atendimento</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">
                  {listaDaVez?.posicaoAtual || 0}º
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-white">{listaDaVez?.atendimentos || 0}</div>
                <div className="text-xs text-gray-400">Atendimentos</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-orange-400">{listaDaVez?.passouvez || 0}</div>
                <div className="text-xs text-gray-400">Passou a vez</div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance do Mês */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Performance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Tempo Médio por Serviço</p>
                <p className="text-gray-400 text-sm">Eficiência nos atendimentos</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-400">
                  {estatisticasMes?.tempoMedioPorServico || 0}min
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Taxa de Comissão</p>
                <p className="text-gray-400 text-sm">Percentual dos serviços</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-400">40%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="space-y-3">
          
          {/* Ver Agenda */}
          <Button 
            onClick={() => window.location.href = "/barbeiro/agenda"}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl"
            size="lg"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Ver Minha Agenda</div>
                  <div className="text-xs opacity-80">Visualizar agendamentos</div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5" />
            </div>
          </Button>

          {/* Relatórios */}
          <Button 
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 py-4 rounded-xl"
            size="lg"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Relatórios Detalhados</div>
                  <div className="text-xs opacity-80">Análise completa</div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5" />
            </div>
          </Button>
        </div>

        {/* Alerta/Dica */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-white font-medium mb-1">Dica do Sistema</h4>
              <p className="text-gray-300 text-sm">
                Sua comissão é calculada automaticamente com base nos serviços finalizados. 
                Mantenha-se ativo na lista da vez para maximizar seus atendimentos!
              </p>
            </div>
          </div>
        </div>

        {/* Espaçamento final */}
        <div className="h-4"></div>
      </div>
    </div>
  );
}