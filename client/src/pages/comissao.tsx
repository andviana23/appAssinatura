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

export default function Comissao() {
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<BarbeiroComissao | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Estados para filtro por período
  const currentDate = new Date();
  const [dataInicio, setDataInicio] = useState(() => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return firstDayOfMonth.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return lastDayOfMonth.toISOString().split('T')[0];
  });

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Query para buscar barbeiros cadastrados da rota de profissionais
  const { data: profissionaisResponse, isLoading: isLoadingProfissionais } = useQuery({
    queryKey: ["/api/profissionais"],
    queryFn: async () => {
      const response = await fetch('/api/profissionais');
      if (!response.ok) throw new Error('Erro ao carregar profissionais');
      return response.json();
    }
  });

  // Query para buscar dados de comissão dos barbeiros com filtro por período
  const { data: comissaoData, isLoading: isLoadingComissao } = useQuery({
    queryKey: ["/api/comissao/barbeiros", currentMonth, dataInicio, dataFim],
  });

  // Query para estatísticas gerais de comissão com filtro por período
  const { data: statsData } = useQuery({
    queryKey: ["/api/comissao/stats", currentMonth, dataInicio, dataFim],
  });

  const isLoading = isLoadingProfissionais || isLoadingComissao;

  // Combinar dados dos profissionais com dados de comissão
  const barbeiros = profissionaisResponse?.data?.filter((prof: any) => prof.tipo === 'barbeiro' && prof.ativo) || [];
  
  const barbeirosComissao: BarbeiroComissao[] = barbeiros.map((barbeiro: any) => {
    // Buscar dados de comissão para este barbeiro
    const comissaoItem = Array.isArray(comissaoData) ? comissaoData.find((item: any) => 
      item.barbeiro?.id === barbeiro.id
    ) : null;

    return {
      barbeiro: {
        id: barbeiro.id,
        nome: barbeiro.nome,
        ativo: barbeiro.ativo
      },
      faturamentoAssinatura: comissaoItem?.faturamentoAssinatura || 0,
      comissaoAssinatura: comissaoItem?.comissaoAssinatura || 0,
      minutosTrabalhadosMes: comissaoItem?.minutosTrabalhadosMes || 0,
      horasTrabalhadasMes: comissaoItem?.horasTrabalhadasMes || "0h 0min",
      numeroServicos: comissaoItem?.numeroServicos || 0,
      percentualTempo: comissaoItem?.percentualTempo || 0
    };
  }).sort((a, b) => b.faturamentoAssinatura - a.faturamentoAssinatura);
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
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Comissão dos Barbeiros</h1>
        <p className="text-muted-foreground">
          Distribuição automática baseada nos atendimentos finalizados
        </p>
        
        {/* Filtros por Período */}
        <div className="mt-4 p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtrar por Período</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="dataInicio" className="text-sm font-medium text-foreground">
                Data Início
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            
            <div>
              <Label htmlFor="dataFim" className="text-sm font-medium text-foreground">
                Data Fim
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="mt-1 bg-background border-border text-foreground"
              />
            </div>
            
            <div>
              <Button 
                onClick={() => {
                  // Força atualização das queries
                  window.location.reload();
                }}
                className="w-full bg-[#8B4513] hover:bg-[#654321]"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Aplicar Filtro
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            Período selecionado: {new Date(dataInicio).toLocaleDateString('pt-BR')} até {new Date(dataFim).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Cards de estatísticas gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Receita Total de Assinatura</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.faturamentoTotalAssinatura)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total de Horas Trabalhadas</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatMinutesToHours(stats.totalMinutosGerais)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total de Comissão</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalComissao)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de barbeiros ordenada por faturamento */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Ranking de Barbeiros (por Faturamento de Assinatura)
        </h2>
        
        {barbeirosComissao.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Nenhum barbeiro cadastrado</p>
            </CardContent>
          </Card>
        ) : (
          barbeirosComissao.map((item, index) => (
            <Card key={item.barbeiro.id} className="hover:shadow-md transition-shadow cursor-pointer bg-card border-border">
              <CardContent className="p-6">
                <div
                  className="flex items-center justify-between"
                  onClick={() => handleBarbeiroClick(item)}
                >
                  <div className="flex items-center space-x-4">
                    {/* Posição no ranking */}
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-bold">
                      {index + 1}
                    </div>
                    
                    {/* Info do barbeiro */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {item.barbeiro.nome}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span className={item.faturamentoAssinatura === 0 ? "opacity-60" : ""}>
                            {item.faturamentoAssinatura === 0 ? "R$ 0,00" : formatCurrency(item.faturamentoAssinatura)}
                          </span>
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span className={item.minutosTrabalhadosMes === 0 ? "opacity-60" : ""}>
                            {item.minutosTrabalhadosMes === 0 ? "0h 0min" : formatMinutesToHours(item.minutosTrabalhadosMes)}
                          </span>
                        </span>
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span className={item.numeroServicos === 0 ? "opacity-60" : ""}>
                            {item.numeroServicos} serviços
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary" className={`${item.comissaoAssinatura === 0 ? "bg-muted text-muted-foreground opacity-60" : "bg-primary/10 text-primary"}`}>
                      {item.percentualTempo.toFixed(1)}% do tempo total
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Sheet lateral com detalhes do barbeiro */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-background border-border">
          {selectedBarbeiro && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground">
                  Detalhes de Comissão
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Nome do barbeiro */}
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {selectedBarbeiro.barbeiro.nome}
                  </h3>
                  <p className="text-muted-foreground">Período: {currentMonth}</p>
                </div>

                {/* Métricas principais */}
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Faturamento de Assinatura</span>
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div className={`text-2xl font-bold ${selectedBarbeiro.faturamentoAssinatura === 0 ? "text-muted-foreground opacity-60" : "text-primary"}`}>
                      {selectedBarbeiro.faturamentoAssinatura === 0 ? "R$ 0,00" : formatCurrency(selectedBarbeiro.faturamentoAssinatura)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedBarbeiro.percentualTempo.toFixed(2)}% do faturamento total
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Comissão de Assinatura</span>
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className={`text-2xl font-bold ${selectedBarbeiro.comissaoAssinatura === 0 ? "text-muted-foreground opacity-60" : "text-green-600 dark:text-green-400"}`}>
                      {selectedBarbeiro.comissaoAssinatura === 0 ? "R$ 0,00" : formatCurrency(selectedBarbeiro.comissaoAssinatura)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      40% do faturamento individual
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Tempo Total Trabalhado</span>
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className={`text-2xl font-bold ${selectedBarbeiro.minutosTrabalhadosMes === 0 ? "text-muted-foreground opacity-60" : "text-primary"}`}>
                      {selectedBarbeiro.minutosTrabalhadosMes === 0 ? "0h 0min" : selectedBarbeiro.horasTrabalhadasMes}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedBarbeiro.minutosTrabalhadosMes} minutos no total
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Serviços Finalizados</span>
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className={`text-2xl font-bold ${selectedBarbeiro.numeroServicos === 0 ? "text-muted-foreground opacity-60" : "text-primary"}`}>
                      {selectedBarbeiro.numeroServicos}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      atendimentos concluídos no mês
                    </div>
                  </div>
                </div>

                {/* Explicação do cálculo */}
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Como é calculado:</h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
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