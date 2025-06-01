import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, DollarSign, Users, ChevronRight, Timer, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface BarbeiroComissao {
  barbeiro: {
    id: number;
    nome: string;
    ativo: boolean;
  };
  faturamentoAssinatura: number;
  comissaoAssinatura: number;
  minutosTrabalhadosMes: number;
  horasTrabalhadasMes: string;
  numeroServicos: number;
  percentualTempo: number;
}

interface ComissaoStats {
  faturamentoTotalAssinatura: number;
  totalMinutosGerais: number;
  totalComissao: number;
}

export default function Distribuicao() {
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<BarbeiroComissao | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Query para buscar dados de comissão dos barbeiros
  const { data: comissaoData, isLoading } = useQuery({
    queryKey: ["/api/comissao/barbeiros", currentMonth],
  });

  // Query para estatísticas gerais de comissão
  const { data: statsData } = useQuery({
    queryKey: ["/api/comissao/stats", currentMonth],
  });

  const barbeirosComissao: BarbeiroComissao[] = Array.isArray(comissaoData) ? comissaoData : [];
  const stats: ComissaoStats = (statsData && typeof statsData === 'object' && !Array.isArray(statsData)) ? statsData : {
    faturamentoTotalAssinatura: 0,
    totalMinutosGerais: 0,
    totalComissao: 0,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) return `${remainingMinutes}min`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}min`;
  };

  const handleBarbeiroClick = (barbeiro: BarbeiroComissao) => {
    setSelectedBarbeiro(barbeiro);
    setIsSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Comissão dos Barbeiros</h1>
        <p className="text-gray-600">
          Distribuição automática baseada nos atendimentos finalizados em {currentMonth}
        </p>
      </div>

      {/* Cards de estatísticas gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total de Assinatura</CardTitle>
            <DollarSign className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">
              {formatCurrency(stats.faturamentoTotalAssinatura)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Horas Trabalhadas</CardTitle>
            <Clock className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">
              {formatMinutesToHours(stats.totalMinutosGerais)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Comissão</CardTitle>
            <Users className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">
              {formatCurrency(stats.totalComissao)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de barbeiros ordenada por faturamento */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[#8B4513] mb-4">
          Ranking de Barbeiros (por Faturamento de Assinatura)
        </h2>
        
        {barbeirosComissao.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Nenhum barbeiro com atendimentos finalizados este mês</p>
            </CardContent>
          </Card>
        ) : (
          barbeirosComissao.map((item, index) => (
            <Card key={item.barbeiro.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div
                  className="flex items-center justify-between"
                  onClick={() => handleBarbeiroClick(item)}
                >
                  <div className="flex items-center space-x-4">
                    {/* Posição no ranking */}
                    <div className="flex items-center justify-center w-8 h-8 bg-[#8B4513] text-white rounded-full font-bold">
                      {index + 1}
                    </div>
                    
                    {/* Info do barbeiro */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#8B4513]">
                        {item.barbeiro.nome}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {formatCurrency(item.faturamentoAssinatura)}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatMinutesToHours(item.minutosTrabalhadosMes)}
                        </span>
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {item.numeroServicos} serviços
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary" className="bg-[#8B4513]/10 text-[#8B4513]">
                      {item.percentualTempo.toFixed(1)}% do tempo total
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Sheet lateral com detalhes do barbeiro */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          {selectedBarbeiro && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#8B4513]">
                  Detalhes de Comissão
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Nome do barbeiro */}
                <div>
                  <h3 className="text-2xl font-bold text-[#8B4513] mb-2">
                    {selectedBarbeiro.barbeiro.nome}
                  </h3>
                  <p className="text-gray-600">Período: {currentMonth}</p>
                </div>

                {/* Métricas principais */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Faturamento de Assinatura</span>
                      <DollarSign className="h-4 w-4 text-[#8B4513]" />
                    </div>
                    <div className="text-2xl font-bold text-[#8B4513]">
                      {formatCurrency(selectedBarbeiro.faturamentoAssinatura)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedBarbeiro.percentualTempo.toFixed(2)}% do faturamento total
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Comissão de Assinatura</span>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedBarbeiro.comissaoAssinatura)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      40% do faturamento individual
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Tempo Total Trabalhado</span>
                      <Clock className="h-4 w-4 text-[#8B4513]" />
                    </div>
                    <div className="text-2xl font-bold text-[#8B4513]">
                      {selectedBarbeiro.horasTrabalhadasMes}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedBarbeiro.minutosTrabalhadosMes} minutos no total
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Serviços Finalizados</span>
                      <Users className="h-4 w-4 text-[#8B4513]" />
                    </div>
                    <div className="text-2xl font-bold text-[#8B4513]">
                      {selectedBarbeiro.numeroServicos}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      atendimentos concluídos no mês
                    </div>
                  </div>
                </div>

                {/* Explicação do cálculo */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Como é calculado:</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• Faturamento = (Tempo trabalhado ÷ Tempo total) × Receita total</p>
                    <p>• Comissão = Faturamento × 40%</p>
                    <p>• Baseado apenas em atendimentos finalizados</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}