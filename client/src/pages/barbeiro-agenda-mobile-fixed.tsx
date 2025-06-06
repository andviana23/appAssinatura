import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Clock, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
}

interface Servico {
  id: number;
  nome: string;
  preco: number;
  tempoMinutos: number;
}

interface Agendamento {
  id: number;
  dataHora: string;
  status: 'AGENDADO' | 'FINALIZADO' | 'CANCELADO';
  clienteId: number;
  servicoId: number;
  barbeiroId: number;
  cliente?: Cliente;
  servico?: Servico;
}

export default function BarbeiroAgendaMobile() {
  const { user } = useAuth();
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Buscar agendamentos
  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["/api/agendamentos", dataSelecionada],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?data=${dataSelecionada}`);
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    },
  });

  // Buscar profissionais
  const { data: profissionais } = useQuery({
    queryKey: ["/api/profissionais"],
    queryFn: async () => {
      const response = await fetch("/api/profissionais");
      if (!response.ok) throw new Error('Erro ao buscar profissionais');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Encontrar profissional correspondente
  const profissional = useMemo(() => {
    return profissionais?.find((p: any) => p.email === user?.email);
  }, [profissionais, user?.email]);

  // Filtrar agendamentos do barbeiro
  const agendamentosBarbeiro = useMemo(() => {
    if (!Array.isArray(agendamentos) || !profissional?.id) return [];
    return agendamentos.filter((agendamento: any) => agendamento.barbeiroId === profissional.id);
  }, [agendamentos, profissional?.id]);

  // Calcular estatísticas
  const estatisticas = useMemo(() => {
    const total = agendamentosBarbeiro.length;
    const finalizados = agendamentosBarbeiro.filter((a: Agendamento) => a.status === 'FINALIZADO').length;
    const agendados = agendamentosBarbeiro.filter((a: Agendamento) => a.status === 'AGENDADO').length;
    const cancelados = agendamentosBarbeiro.filter((a: Agendamento) => a.status === 'CANCELADO').length;
    
    return { total, finalizados, agendados, cancelados };
  }, [agendamentosBarbeiro]);

  // Aplicar filtro
  const agendamentosFiltrados = useMemo(() => {
    if (filtroStatus === "todos") return agendamentosBarbeiro;
    return agendamentosBarbeiro.filter((agendamento: Agendamento) => agendamento.status === filtroStatus);
  }, [agendamentosBarbeiro, filtroStatus]);

  // Navegação de data
  const navegarData = useCallback((direcao: 'anterior' | 'proximo') => {
    // Usar parseISO para evitar problemas de timezone
    const [ano, mes, dia] = dataSelecionada.split('-').map(Number);
    const dataAtual = new Date(ano, mes - 1, dia); // mes - 1 porque Date usa 0-11 para meses
    
    const novaData = direcao === 'anterior' 
      ? subDays(dataAtual, 1) 
      : addDays(dataAtual, 1);
    setDataSelecionada(format(novaData, "yyyy-MM-dd"));
  }, [dataSelecionada]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-3">
        <div className="max-w-md mx-auto space-y-4">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-800 rounded-xl mb-4"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>
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
        
        {/* Header Mobile */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/barbeiro"}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-400" />
                <h1 className="text-lg font-bold text-white">Minha Agenda</h1>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Visualização dos seus agendamentos
              </p>
            </div>
          </div>
        </div>

        {/* Navegação de Data */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navegarData('anterior')}
              className="p-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span className="text-white font-semibold">
                  {format(new Date(dataSelecionada), "dd/MM")}
                </span>
              </div>
              <p className="text-xs text-gray-400 capitalize">
                {format(new Date(dataSelecionada), "EEEE", { locale: ptBR })}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navegarData('proximo')}
              className="p-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-white mb-1">{estatisticas.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">{estatisticas.finalizados}</div>
            <div className="text-xs text-gray-400">Finalizados</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">{estatisticas.agendados}</div>
            <div className="text-xs text-gray-400">Agendados</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
            <div className="text-2xl font-bold text-red-400 mb-1">{estatisticas.cancelados}</div>
            <div className="text-xs text-gray-400">Cancelados</div>
          </div>
        </div>

        {/* Filtro de Status */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-300">Filtrar por status</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: "todos", label: "Todos", count: estatisticas.total },
              { value: "AGENDADO", label: "Agendados", count: estatisticas.agendados },
              { value: "FINALIZADO", label: "Finalizados", count: estatisticas.finalizados },
              { value: "CANCELADO", label: "Cancelados", count: estatisticas.cancelados }
            ].map((filtro) => (
              <Button
                key={filtro.value}
                variant={filtroStatus === filtro.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroStatus(filtro.value)}
                className={`whitespace-nowrap text-xs ${
                  filtroStatus === filtro.value 
                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                    : "bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {filtro.label} ({filtro.count})
              </Button>
            ))}
          </div>
        </div>

        {/* Lista de Agendamentos */}
        <div className="space-y-3">
          {agendamentosFiltrados.length > 0 ? (
            agendamentosFiltrados.map((agendamento: Agendamento) => (
              <div key={agendamento.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-sm font-bold ${
                    agendamento.status === 'FINALIZADO' ? 'text-green-400' :
                    agendamento.status === 'CANCELADO' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {format(new Date(agendamento.dataHora), "HH:mm")}
                  </div>
                  <Badge 
                    className={`text-xs px-2 py-1 ${
                      agendamento.status === 'FINALIZADO' 
                        ? 'bg-green-600 text-white'
                        : agendamento.status === 'CANCELADO'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {agendamento.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-white text-sm font-medium">
                      {agendamento.cliente?.nome || 'Cliente não encontrado'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {agendamento.servico?.nome || 'Serviço não encontrado'} • {agendamento.servico?.tempoMinutos || 30}min
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-1">
                {estatisticas.total === 0 ? 'Nenhum agendamento' : 'Nenhum resultado'}
              </h3>
              <p className="text-gray-400 text-sm">
                {estatisticas.total === 0 
                  ? 'Você não tem agendamentos para esta data'
                  : 'Nenhum agendamento encontrado para este filtro'
                }
              </p>
            </div>
          )}
        </div>

        {/* Espaçamento final para navegação móvel */}
        <div className="h-4"></div>
      </div>
    </div>
  );
}