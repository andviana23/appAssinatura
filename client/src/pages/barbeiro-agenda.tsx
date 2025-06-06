import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// Definir tipos
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

export default function BarbeiroAgenda() {
  const { user } = useAuth();
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Buscar agendamentos da fonte oficial (mesma da página principal)
  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["/api/agendamentos", dataSelecionada],
    queryFn: () => apiRequest(`/api/agendamentos?data=${dataSelecionada}`),
  });

  // Filtrar apenas agendamentos do barbeiro logado da fonte oficial
  // Para barbeiros, usar user.id como barbeiroId, pois barbeiros são profissionais
  const barbeiroId = user?.barbeiroId || user?.id;
  const agendamentosBarbeiro = Array.isArray(agendamentos) 
    ? agendamentos.filter((agendamento: any) => 
        agendamento.barbeiroId === barbeiroId
      )
    : [];

  // Debug: log para verificar se está filtrando corretamente
  console.log(`Barbeiro logado ID: ${barbeiroId}, Total agendamentos: ${agendamentos?.length || 0}, Filtrados: ${agendamentosBarbeiro.length}`);

  // Aplicar filtro de status
  const agendamentosFiltrados = agendamentosBarbeiro.filter((agendamento: Agendamento) => {
    if (filtroStatus === "todos") return true;
    return agendamento.status === filtroStatus;
  });

  // Separar agendamentos por status
  const agendamentosFinalizados = agendamentosFiltrados.filter((a: Agendamento) => a.status === 'FINALIZADO');
  const agendamentosAgendados = agendamentosFiltrados.filter((a: Agendamento) => a.status === 'AGENDADO');
  const agendamentosCancelados = agendamentosFiltrados.filter((a: Agendamento) => a.status === 'CANCELADO');

  // Estatísticas do dia
  const totalAgendamentos = agendamentosBarbeiro.length;
  const finalizados = agendamentosFinalizados.length;
  const agendados = agendamentosAgendados.length;
  const cancelados = agendamentosCancelados.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FINALIZADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'AGENDADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FINALIZADO': return <CheckCircle className="h-4 w-4" />;
      case 'AGENDADO': return <AlertCircle className="h-4 w-4" />;
      case 'CANCELADO': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const navegarData = (direcao: 'anterior' | 'proximo') => {
    const dataAtual = new Date(dataSelecionada + 'T12:00:00'); // Força meio-dia para evitar problemas de timezone
    const novaData = direcao === 'anterior' 
      ? new Date(dataAtual.getTime() - 24 * 60 * 60 * 1000) // Subtrai exatamente 24 horas
      : new Date(dataAtual.getTime() + 24 * 60 * 60 * 1000); // Adiciona exatamente 24 horas
    setDataSelecionada(format(novaData, "yyyy-MM-dd"));
  };

  const AgendamentoCard = ({ agendamento }: { agendamento: Agendamento }) => (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-[#365e78]">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-[#365e78]/10 rounded-full">
              <Clock className="h-6 w-6 text-[#365e78]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold text-[#365e78]">
                  {format(new Date(agendamento.dataHora), "HH:mm")}
                </span>
                <Badge className={`${getStatusColor(agendamento.status)} text-xs`}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(agendamento.status)}
                    {agendamento.status}
                  </span>
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{agendamento.cliente?.nome || 'Cliente não encontrado'}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Serviço:</span> {agendamento.servico?.nome || 'Serviço não encontrado'}
                </div>
                <div className="text-xs text-gray-500">
                  Duração: {agendamento.servico?.tempoMinutos || 30} min
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SecaoAgendamentos = ({ titulo, agendamentos, icon, cor }: { 
    titulo: string; 
    agendamentos: Agendamento[]; 
    icon: React.ReactNode;
    cor: string;
  }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${cor}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {titulo}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      
      {agendamentos.length > 0 ? (
        <div className="space-y-3">
          {agendamentos.map((agendamento) => (
            <AgendamentoCard key={agendamento.id} agendamento={agendamento} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 dark:text-gray-600 mb-2">
              {icon}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhum agendamento {titulo.toLowerCase()} para esta data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/barbeiro"}
            className="flex items-center gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Eye className="h-6 w-6 text-[#365e78]" />
              Minha Agenda
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                SOMENTE VISUALIZAÇÃO
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Seus agendamentos da base oficial do sistema
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Data e Filtro */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              
              {/* Navegação de Data */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navegarData('anterior')}
                  className="p-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 px-4 py-2 bg-[#365e78]/10 rounded-lg">
                  <Calendar className="h-4 w-4 text-[#365e78]" />
                  <span className="font-medium text-[#365e78] min-w-[120px] text-center">
                    {format(new Date(dataSelecionada), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navegarData('proximo')}
                  className="p-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Filtro de Status */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="AGENDADO">Agendados</SelectItem>
                    <SelectItem value="FINALIZADO">Finalizados</SelectItem>
                    <SelectItem value="CANCELADO">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas do Dia */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[#365e78]">{totalAgendamentos}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{finalizados}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Finalizados</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{agendados}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Agendados</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{cancelados}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Cancelados</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Agendamentos por Status */}
        <div className="space-y-8">
          
          {/* Agendamentos Pendentes */}
          {(filtroStatus === "todos" || filtroStatus === "AGENDADO") && (
            <SecaoAgendamentos
              titulo="Agendados"
              agendamentos={agendamentosAgendados}
              icon={<AlertCircle className="h-5 w-5 text-blue-600" />}
              cor="bg-blue-100 text-blue-600"
            />
          )}

          {/* Agendamentos Finalizados */}
          {(filtroStatus === "todos" || filtroStatus === "FINALIZADO") && (
            <SecaoAgendamentos
              titulo="Finalizados"
              agendamentos={agendamentosFinalizados}
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              cor="bg-green-100 text-green-600"
            />
          )}

          {/* Agendamentos Cancelados */}
          {(filtroStatus === "todos" || filtroStatus === "CANCELADO") && (
            <SecaoAgendamentos
              titulo="Cancelados"
              agendamentos={agendamentosCancelados}
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              cor="bg-red-100 text-red-600"
            />
          )}
        </div>

        {/* Mensagem quando não há agendamentos */}
        {totalAgendamentos === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nenhum agendamento encontrado
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Você não tem agendamentos para {format(new Date(dataSelecionada), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}