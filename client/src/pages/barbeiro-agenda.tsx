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

  // Buscar agendamentos do endpoint oficial da página de agendamento
  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["/api/agendamentos", dataSelecionada],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?data=${dataSelecionada}`);
      if (!response.ok) throw new Error('Erro ao buscar agendamentos');
      return response.json();
    },
  });

  // Buscar dados do profissional baseado no email do usuário
  const { data: profissionais } = useQuery({
    queryKey: ["/api/profissionais"],
    queryFn: async () => {
      const response = await fetch("/api/profissionais");
      if (!response.ok) throw new Error('Erro ao buscar profissionais');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Encontrar o profissional correspondente ao usuário logado
  const profissional = profissionais?.find((p: any) => p.email === user?.email);
  const barbeiroId = profissional?.id;

  // Filtrar apenas agendamentos do barbeiro logado
  const agendamentosBarbeiro = Array.isArray(agendamentos) && barbeiroId
    ? agendamentos.filter((agendamento: any) => agendamento.barbeiroId === barbeiroId)
    : [];

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
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-white mb-1">{totalAgendamentos}</div>
              <div className="text-sm text-gray-400">Total</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{finalizados}</div>
              <div className="text-sm text-gray-400">Finalizados</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">{agendados}</div>
              <div className="text-sm text-gray-400">Agendados</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-400 mb-1">{cancelados}</div>
              <div className="text-sm text-gray-400">Cancelados</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline de Agendamentos */}
        <div className="space-y-6">
          
          {/* Agendados */}
          {(filtroStatus === "todos" || filtroStatus === "AGENDADO") && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Agendados</h3>
                  <p className="text-sm text-gray-400">{agendados} agendamentos</p>
                </div>
              </div>
              
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  {agendamentosAgendados.length > 0 ? (
                    <div className="space-y-3">
                      {agendamentosAgendados.map((agendamento) => (
                        <div key={agendamento.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-blue-400">
                              {format(new Date(agendamento.dataHora), "HH:mm")}
                            </div>
                            <div>
                              <p className="font-medium text-white">{agendamento.cliente?.nome}</p>
                              <p className="text-sm text-gray-400">{agendamento.servico?.nome}</p>
                            </div>
                          </div>
                          <Badge className="bg-blue-500 text-white">AGENDADO</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum agendamento agendados para esta data</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Finalizados */}
          {(filtroStatus === "todos" || filtroStatus === "FINALIZADO") && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Finalizados</h3>
                  <p className="text-sm text-gray-400">{finalizados} agendamentos</p>
                </div>
              </div>
              
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  {agendamentosFinalizados.length > 0 ? (
                    <div className="space-y-3">
                      {agendamentosFinalizados.map((agendamento) => (
                        <div key={agendamento.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-green-400">
                              {format(new Date(agendamento.dataHora), "HH:mm")}
                            </div>
                            <div>
                              <p className="font-medium text-white">{agendamento.cliente?.nome}</p>
                              <p className="text-sm text-gray-400">{agendamento.servico?.nome}</p>
                            </div>
                          </div>
                          <Badge className="bg-green-500 text-white">FINALIZADO</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum agendamento finalizados para esta data</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cancelados */}
          {(filtroStatus === "todos" || filtroStatus === "CANCELADO") && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Cancelados</h3>
                  <p className="text-sm text-gray-400">{cancelados} agendamentos</p>
                </div>
              </div>
              
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  {agendamentosCancelados.length > 0 ? (
                    <div className="space-y-3">
                      {agendamentosCancelados.map((agendamento) => (
                        <div key={agendamento.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-red-400">
                              {format(new Date(agendamento.dataHora), "HH:mm")}
                            </div>
                            <div>
                              <p className="font-medium text-white">{agendamento.cliente?.nome}</p>
                              <p className="text-sm text-gray-400">{agendamento.servico?.nome}</p>
                            </div>
                          </div>
                          <Badge className="bg-red-500 text-white">CANCELADO</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum agendamento cancelados para esta data</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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