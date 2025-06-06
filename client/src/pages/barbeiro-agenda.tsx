import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, User, Filter, Search, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Agendamento {
  id: number;
  clienteId: number;
  barbeiroId: number;
  servicoId: number;
  dataHora: string;
  status: 'AGENDADO' | 'FINALIZADO' | 'CANCELADO';
  observacoes?: string;
  cliente?: { nome: string };
  servico?: { nome: string; tempoMinutos: number };
}

export default function BarbeiroAgenda() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Estados para filtros
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [termoBusca, setTermoBusca] = useState("");
  
  // Buscar agendamentos do barbeiro
  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["/api/barbeiro/agenda", dataSelecionada],
    queryFn: () => apiRequest(`/api/barbeiro/agenda?data=${dataSelecionada}`),
  });

  // Filtrar agendamentos do barbeiro logado
  const agendamentosBarbeiro = Array.isArray(agendamentos) 
    ? agendamentos.filter((agendamento: Agendamento) => 
        agendamento.barbeiroId === user?.barbeiroId
      )
    : [];

  // Aplicar filtros
  const agendamentosFiltrados = agendamentosBarbeiro.filter((agendamento: Agendamento) => {
    const matchStatus = filtroStatus === "todos" || agendamento.status === filtroStatus;
    const matchBusca = !termoBusca || 
      agendamento.cliente?.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      agendamento.servico?.nome.toLowerCase().includes(termoBusca.toLowerCase());
    
    return matchStatus && matchBusca;
  });

  // Estatísticas do dia
  const totalAgendamentos = agendamentosBarbeiro.length;
  const finalizados = agendamentosBarbeiro.filter(a => a.status === 'FINALIZADO').length;
  const cancelados = agendamentosBarbeiro.filter(a => a.status === 'CANCELADO').length;
  const pendentes = agendamentosBarbeiro.filter(a => a.status === 'AGENDADO').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FINALIZADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      case 'AGENDADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FINALIZADO': return <CheckCircle className="h-4 w-4" />;
      case 'CANCELADO': return <XCircle className="h-4 w-4" />;
      case 'AGENDADO': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#365e78]/5 via-white to-[#2a4a5e]/5">
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header Mobile First */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => setLocation("/barbeiro")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-semibold text-sm">Voltar</span>
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-xl flex items-center justify-center shadow-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                  Minha Agenda
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {isToday(parseISO(dataSelecionada)) ? "Hoje" : format(parseISO(dataSelecionada), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Filtros Mobile Responsive */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                {/* Data e Status */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Data</label>
                    <Input
                      type="date"
                      value={dataSelecionada}
                      onChange={(e) => setDataSelecionada(e.target.value)}
                      className="w-full text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                    <select 
                      value={filtroStatus} 
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#365e78]/20 focus:border-[#365e78]"
                    >
                      <option value="todos">Todos</option>
                      <option value="AGENDADO">Agendados</option>
                      <option value="FINALIZADO">Finalizados</option>
                      <option value="CANCELADO">Cancelados</option>
                    </select>
                  </div>
                </div>
                
                {/* Busca */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Nome do cliente ou serviço..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="pl-10 text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Estatísticas - Mobile First */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-[#365e78]">{totalAgendamentos}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-green-600">{finalizados}</div>
              <div className="text-xs sm:text-sm text-gray-600">Finalizados</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{pendentes}</div>
              <div className="text-xs sm:text-sm text-gray-600">Pendentes</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-red-600">{cancelados}</div>
              <div className="text-xs sm:text-sm text-gray-600">Cancelados</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Agendamentos - Mobile First */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] text-white rounded-t-lg p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              Agendamentos ({agendamentosFiltrados.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-[#365e78] border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Carregando agendamentos...</p>
              </div>
            ) : agendamentosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum agendamento encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentosFiltrados.map((agendamento: Agendamento) => (
                  <Card key={agendamento.id} className="border border-gray-200 hover:shadow-md transition-all duration-200">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Informações principais */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-[#365e78]" />
                            <span className="font-semibold text-sm sm:text-base text-gray-900">
                              {agendamento.cliente?.nome || "Cliente não identificado"}
                            </span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(agendamento.dataHora), "HH:mm")}
                            </div>
                            <div className="hidden sm:block">•</div>
                            <div>
                              {agendamento.servico?.nome} ({agendamento.servico?.tempoMinutos}min)
                            </div>
                          </div>
                          
                          {agendamento.observacoes && (
                            <div className="text-xs text-gray-500 italic">
                              "{agendamento.observacoes}"
                            </div>
                          )}
                        </div>
                        
                        {/* Status */}
                        <div className="flex justify-start sm:justify-end">
                          <Badge className={`${getStatusColor(agendamento.status)} flex items-center gap-1 text-xs px-2 py-1`}>
                            {getStatusIcon(agendamento.status)}
                            {agendamento.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}