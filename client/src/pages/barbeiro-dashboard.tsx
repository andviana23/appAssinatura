import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, Clock, DollarSign, Calendar, TrendingUp, Award, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function BarbeiroDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
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
  const mesAtual = format(hoje, "yyyy-MM");

  // Filtrar apenas agendamentos do barbeiro logado
  const agendamentosBarbeiro = Array.isArray(agendamentos)
    ? agendamentos.filter(agendamento => agendamento.barbeiroId === user?.barbeiroId)
    : [];

  const agendamentosHoje = agendamentosBarbeiro.filter(agendamento => {
    const dataAgendamento = format(new Date(agendamento.dataHora), "yyyy-MM-dd");
    return dataAgendamento === format(hoje, "yyyy-MM-dd");
  });

  const agendamentosMes = agendamentosBarbeiro.filter(agendamento => {
    const dataAgendamento = format(new Date(agendamento.dataHora), "yyyy-MM");
    return dataAgendamento === mesAtual;
  });

  // Calcular tempo trabalhado do mês (assumindo 30 min por agendamento)
  const tempoTrabalhadoMes = agendamentosMes.reduce((total, agendamento) => {
    return total + (agendamento.servico?.tempoMinutos || 30);
  }, 0);

  const horasTrabalhadasMes = Math.floor(tempoTrabalhadoMes / 60);
  const minutosRestantes = tempoTrabalhadoMes % 60;

  // Calcular posição na fila e informações da lista da vez
  const meuDadosFila = Array.isArray(filaMensal) 
    ? filaMensal.find(item => item.barbeiro?.id === user?.barbeiroId)
    : null;
  
  const posicaoNaFila = meuDadosFila?.posicaoMensal || 0;
  const clientesAtendidosMes = meuDadosFila?.totalAtendimentosMes || 0;
  
  // Verificar se é a vez do barbeiro (posição 1 na fila)
  const ehMinhaVez = posicaoNaFila === 1;
  
  // Calcular quando será a vez (se não for a vez atual)
  const proximosNaFila = ehMinhaVez ? 0 : posicaoNaFila - 1;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-colors bg-[#365e78]/10 rounded-xl px-4 py-2 hover:bg-[#365e78]/20"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-semibold">Voltar</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-[#365e78]">Meu Desempenho</h1>
            <p className="text-gray-600">
              {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#365e78]">
          <Scissors className="h-6 w-6" />
          <span className="font-semibold">Barbeiro</span>
        </div>
      </div>

      {/* Cards de Resumo - Responsivos */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Comissão do Mês
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {comissaoLoading ? "..." : `R$ ${(comissaoData?.comissaoCalculada || 0).toFixed(2)}`}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <DollarSign className="inline h-3 w-3 mr-1" />
                  Calculada
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
                  Atendimentos Hoje
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {agendamentosLoading ? "..." : agendamentosHoje.length}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Agendados
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
                  Tempo Trabalhado
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {agendamentosLoading ? "..." : `${horasTrabalhadasMes}h ${minutosRestantes}m`}
                </p>
                <p className="text-sm text-[#365e78] mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Este mês
                </p>
              </div>
              <div className="h-12 w-12 bg-[#365e78]/10 rounded-2xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-[#365e78]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Atendimentos Mês
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {agendamentosLoading ? "..." : agendamentosMes.length}
                </p>
                <p className="text-sm text-[#d3b791] mt-1">
                  <Award className="inline h-3 w-3 mr-1" />
                  Total
                </p>
              </div>
              <div className="h-12 w-12 bg-[#d3b791]/20 rounded-2xl flex items-center justify-center">
                <Award className="h-6 w-6 text-[#d3b791]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards da Lista da Vez */}
        <Card className={ehMinhaVez ? "border-green-500 bg-green-50" : "border-orange-500 bg-orange-50"}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {ehMinhaVez ? "É Sua Vez!" : "Posição na Fila"}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {filaLoading ? "..." : ehMinhaVez ? "1º" : `${posicaoNaFila}º`}
                </p>
                <p className="text-xs sm:text-sm mt-1" style={{color: ehMinhaVez ? "#059669" : "#ea580c"}}>
                  {ehMinhaVez ? "Atenda agora!" : `${proximosNaFila} na frente`}
                </p>
              </div>
              <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center ${ehMinhaVez ? "bg-green-100" : "bg-orange-100"}`}>
                <Award className={`h-5 w-5 sm:h-6 sm:w-6 ${ehMinhaVez ? "text-green-600" : "text-orange-600"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Clientes Atendidos
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {filaLoading ? "..." : clientesAtendidosMes}
                </p>
                <p className="text-xs sm:text-sm text-purple-600 mt-1">
                  Este mês
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Scissors className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas Detalhadas */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#365e78]">
              <TrendingUp className="h-6 w-6" />
              Desempenho do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Participação no faturamento</span>
                <span className="font-semibold">
                  {comissaoLoading ? "..." : `${(comissaoData?.percentualParticipacao || 0).toFixed(1)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Faturamento proporcional</span>
                <span className="font-semibold">
                  {comissaoLoading ? "..." : `R$ ${(comissaoData?.faturamentoProporcional || 0).toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Minutos trabalhados</span>
                <span className="font-semibold">
                  {comissaoLoading ? "..." : `${comissaoData?.minutosTrabalhadosMes || 0} min`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#365e78]">
              <Calendar className="h-6 w-6" />
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
            ) : agendamentosBarbeiro.length > 0 ? (
              <div className="space-y-3">
                {agendamentosBarbeiro
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
                          {agendamento.servico?.nome || 'Serviço não informado'}
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

      {/* Resumo de Comissão */}
      {!comissaoLoading && comissaoData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-[#365e78]">
              <DollarSign className="h-6 w-6" />
              Detalhes da Comissão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Total de Comissão do Mês</p>
                <p className="text-4xl font-bold text-green-600 mb-4">
                  R$ {(comissaoData.comissaoCalculada || 0).toFixed(2)}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">Participação</p>
                    <p className="text-[#365e78]">{(comissaoData.percentualParticipacao || 0).toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">Faturamento</p>
                    <p className="text-[#365e78]">R$ {(comissaoData.faturamentoProporcional || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">Minutos</p>
                    <p className="text-[#365e78]">{comissaoData.minutosTrabalhadosMes || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}