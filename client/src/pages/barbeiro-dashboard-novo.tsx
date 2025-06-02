import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, Clock, DollarSign, Calendar, TrendingUp, Award, ArrowLeft, Filter, User, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import dayjs from "dayjs";

export default function BarbeiroDashboardNovo() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Estados para filtros
  const [filtroMes, setFiltroMes] = useState(dayjs().format("YYYY-MM"));
  const [filtroAno, setFiltroAno] = useState(dayjs().format("YYYY"));
  
  // Buscar dados de comissão do barbeiro específico
  const { data: comissaoData, isLoading: comissaoLoading } = useQuery({
    queryKey: ["/api/comissoes/barbeiro"],
    queryFn: () => apiRequest("/api/comissoes/barbeiro"),
  });

  // Buscar agendamentos do barbeiro
  const { data: agendamentos, isLoading: agendamentosLoading } = useQuery({
    queryKey: ["/api/agendamentos"],
    queryFn: () => apiRequest("/api/agendamentos"),
  });

  // Buscar dados da fila mensal
  const { data: filaMensal, isLoading: filaLoading } = useQuery({
    queryKey: ["/api/lista-da-vez/fila-mensal"],
    queryFn: () => apiRequest("/api/lista-da-vez/fila-mensal"),
  });

  const hoje = new Date();
  
  // Filtrar apenas agendamentos do barbeiro logado
  const agendamentosBarbeiro = Array.isArray(agendamentos)
    ? agendamentos.filter(agendamento => agendamento.barbeiroId === user?.barbeiroId)
    : [];

  // Filtrar por data selecionada
  const agendamentosHoje = agendamentosBarbeiro.filter(agendamento => {
    const dataAgendamento = format(new Date(agendamento.dataHora), "yyyy-MM-dd", { locale: ptBR });
    return dataAgendamento === format(hoje, "yyyy-MM-dd", { locale: ptBR });
  });

  const agendamentosMes = agendamentosBarbeiro.filter(agendamento => {
    const dataAgendamento = format(new Date(agendamento.dataHora), "yyyy-MM", { locale: ptBR });
    return dataAgendamento === filtroMes;
  });

  // Calcular comissão do mês selecionado
  const comissaoMesFiltrado = Array.isArray(comissaoData) 
    ? comissaoData.filter(comissao => {
        const mesComissao = format(new Date(comissao.createdAt), "yyyy-MM", { locale: ptBR });
        return mesComissao === filtroMes;
      })
    : [];

  const totalComissaoMes = comissaoMesFiltrado.reduce((total, comissao) => {
    return total + parseFloat(comissao.valor || '0');
  }, 0);

  // Dados da fila mensal
  const meuDadosFila = Array.isArray(filaMensal) 
    ? filaMensal.find(item => item.barbeiro?.id === user?.barbeiroId)
    : null;
  
  const posicaoNaFila = meuDadosFila?.posicaoMensal || 0;
  const clientesAtendidosMes = meuDadosFila?.totalAtendimentosMes || 0;
  const diasPassouVez = meuDadosFila?.diasPassouAVez || 0;
  
  // Verificar se é a vez do barbeiro
  const ehMinhaVez = posicaoNaFila === 1;

  // Gerar opções de anos e meses
  const anosDisponiveis = [];
  for (let i = 2024; i <= dayjs().year(); i++) {
    anosDisponiveis.push(i.toString());
  }

  const mesesDisponiveis = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#365e78]/5 via-white to-[#2a4a5e]/5">
      <div className="p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </Button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
                <Scissors className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                  Meu Desempenho
                </h1>
                <p className="text-gray-600 mt-1">
                  {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Filtros de Data */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-[#365e78]" />
                <span className="text-sm font-medium text-[#365e78]">Filtros:</span>
                <Select value={filtroAno} onValueChange={setFiltroAno}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map(ano => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={filtroMes.split('-')[1]} 
                  onValueChange={(mes) => setFiltroMes(`${filtroAno}-${mes}`)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.map(mes => (
                      <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {/* Comissão do Mês */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Comissão do Mês
                  </p>
                  <p className="text-2xl font-bold text-[#365e78] mt-1">
                    {comissaoLoading ? "..." : `R$ ${totalComissaoMes.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    <DollarSign className="inline h-3 w-3 mr-1" />
                    {comissaoMesFiltrado.length} registros
                  </p>
                </div>
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Atendimentos Hoje */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Atendimentos Hoje
                  </p>
                  <p className="text-2xl font-bold text-[#365e78] mt-1">
                    {agendamentosLoading ? "..." : agendamentosHoje.length}
                  </p>
                  <p className="text-xs text-blue-600 mt-2 flex items-center">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {format(hoje, "dd/MM")}
                  </p>
                </div>
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Scissors className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posição na Fila */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Posição na Fila
                  </p>
                  <p className="text-2xl font-bold text-[#365e78] mt-1">
                    {filaLoading ? "..." : `${posicaoNaFila}º`}
                  </p>
                  <p className="text-xs text-orange-600 mt-2 flex items-center">
                    <Target className="inline h-3 w-3 mr-1" />
                    {ehMinhaVez ? "É sua vez!" : "Aguardando"}
                  </p>
                </div>
                <div className={`h-12 w-12 bg-gradient-to-br ${ehMinhaVez ? 'from-green-500 to-emerald-600' : 'from-orange-500 to-orange-600'} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Award className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clientes no Mês */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Clientes no Mês
                  </p>
                  <p className="text-2xl font-bold text-[#365e78] mt-1">
                    {filaLoading ? "..." : clientesAtendidosMes}
                  </p>
                  <p className="text-xs text-purple-600 mt-2 flex items-center">
                    <User className="inline h-3 w-3 mr-1" />
                    Lista da vez
                  </p>
                </div>
                <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes da Comissão */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] text-white rounded-t-lg">
            <CardTitle className="text-xl">Detalhes das Comissões</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {comissaoLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Carregando comissões...</p>
              </div>
            ) : comissaoMesFiltrado.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhuma comissão registrada para este período.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comissaoMesFiltrado.map((comissao, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        Comissão de {format(new Date(comissao.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-gray-600">
                        Mês: {format(new Date(comissao.createdAt), "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        R$ {parseFloat(comissao.valor || '0').toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Comissão registrada
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status na Lista da Vez */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] text-white rounded-t-lg">
            <CardTitle className="text-xl">Minha Posição na Lista da Vez</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className={`h-16 w-16 mx-auto mb-3 ${ehMinhaVez ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                  <Award className={`h-8 w-8 ${ehMinhaVez ? 'text-green-600' : 'text-orange-600'}`} />
                </div>
                <p className="text-2xl font-bold text-[#365e78]">{posicaoNaFila}º</p>
                <p className="text-sm text-gray-600">Posição atual</p>
              </div>
              
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-[#365e78]">{clientesAtendidosMes}</p>
                <p className="text-sm text-gray-600">Clientes atendidos</p>
              </div>
              
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-[#365e78]">{diasPassouVez}</p>
                <p className="text-sm text-gray-600">Vezes que passou</p>
              </div>
            </div>
            
            {ehMinhaVez && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-center text-green-800 font-medium">
                  🎉 É a sua vez! Você é o próximo na fila de atendimento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}