import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, DollarSign, ArrowLeft, Target, BarChart3, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function BarbeiroDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Buscar estatísticas específicas do barbeiro
  const { data: estatisticas, isLoading: estatisticasLoading } = useQuery({
    queryKey: ["/api/barbeiro/estatisticas"],
    queryFn: () => apiRequest("/api/barbeiro/estatisticas"),
  });

  // Buscar posição na fila
  const { data: posicaoFila, isLoading: filaLoading } = useQuery({
    queryKey: ["/api/barbeiro/posicao-fila"],
    queryFn: () => apiRequest("/api/barbeiro/posicao-fila"),
  });

  // Buscar dados de comissão do barbeiro específico
  const { data: comissaoData, isLoading: comissaoLoading } = useQuery({
    queryKey: ["/api/comissoes/barbeiro"],
    queryFn: () => apiRequest("/api/comissoes/barbeiro"),
  });

  const hoje = new Date();
  const mesAtual = format(hoje, "MMMM yyyy", { locale: ptBR });
  
  // Função para determinar a cor do status da fila
  const getStatusFilaColor = (status: string) => {
    if (status.includes("É SUA VEZ")) return "bg-green-100 text-green-800 border-green-300";
    if (status.includes("PRÓXIMO")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (status.includes("pessoas na sua frente")) return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  if (estatisticasLoading || filaLoading || comissaoLoading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#365e78] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando suas estatísticas...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-[#365e78]">Painel do Barbeiro</h1>
            <p className="text-gray-600">
              {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#365e78]">
          <Scissors className="h-6 w-6" />
          <span className="font-semibold">Olá, {user?.nome}</span>
        </div>
      </div>

      {/* Seção 1: Suas Estatísticas */}
      <Card className="border-2 border-[#365e78]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#365e78]">
            <BarChart3 className="h-5 w-5" />
            📊 SUAS ESTATÍSTICAS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium">Total de atendimentos</p>
              <p className="text-3xl font-bold text-[#365e78]">
                {estatisticas?.totalAtendimentos || 0}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium">Média de atendimentos (por dia)</p>
              <p className="text-3xl font-bold text-[#365e78]">
                {estatisticas?.mediaAtendimentos || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Sua Posição na Fila */}
      <Card className={`border-2 ${posicaoFila?.statusFila?.includes("É SUA VEZ") ? "border-green-300 bg-green-50" : "border-[#365e78]/20"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#365e78]">
            <Target className="h-5 w-5" />
            🎯 SUA POSIÇÃO NA FILA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Badge 
              className={`text-lg px-4 py-2 ${getStatusFilaColor(posicaoFila?.statusFila || "")}`}
              variant="outline"
            >
              {posicaoFila?.statusFila || "Carregando..."}
            </Badge>
            {posicaoFila?.posicao && posicaoFila.posicao > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Posição: {posicaoFila.posicao}º de {posicaoFila.totalBarbeiros} barbeiros
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Serviços do Mês */}
      <Card className="border-2 border-[#365e78]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#365e78]">
            <Trophy className="h-5 w-5" />
            📈 SERVIÇOS DO MÊS ({mesAtual})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estatisticas?.servicosPorTipo && estatisticas.servicosPorTipo.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {estatisticas.servicosPorTipo.map((servico: any, index: number) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-800">{servico.servicoNome}</p>
                  <p className="text-2xl font-bold text-[#365e78]">{servico.quantidade}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum serviço realizado este mês</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção Adicional: Dados de Comissão (mantido da versão anterior) */}
      {comissaoData && (
        <Card className="border-2 border-[#365e78]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#365e78]">
              <DollarSign className="h-5 w-5" />
              💰 COMISSÃO DO MÊS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Comissão Calculada</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {comissaoData.comissaoCalculada?.toFixed(2) || "0,00"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Participação</p>
                <p className="text-2xl font-bold text-[#365e78]">
                  {comissaoData.percentualParticipacao?.toFixed(1) || "0"}%
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Faturamento Proporcional</p>
                <p className="text-2xl font-bold text-[#365e78]">
                  R$ {comissaoData.faturamentoProporcional?.toFixed(2) || "0,00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}