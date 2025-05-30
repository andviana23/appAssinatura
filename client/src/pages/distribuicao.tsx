import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, getInitials, getCurrentMonth } from "@/lib/utils";
import { Calculator, Download, Save, Clock } from "lucide-react";
import type { Barbeiro, Servico } from "@shared/schema";

interface DistribuicaoData {
  [barbeiroId: string]: {
    [servicoId: string]: number;
  };
}

interface ResultadoDistribuicao {
  barbeiro: Barbeiro;
  minutesWorked: number;
  participationRate: number;
  revenueShare: number;
  commission: number;
}

interface CalculationResult {
  resultados: ResultadoDistribuicao[];
  totalMinutesPool: number;
  poolValue: number;
}

export default function Distribuicao() {
  const [periodoInicio, setPeriodoInicio] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0]
  );
  const [periodoFim, setPeriodoFim] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [faturamentoTotal, setFaturamentoTotal] = useState("28450.00");
  const [percentualComissao, setPercentualComissao] = useState(40);
  const [distribuicaoData, setDistribuicaoData] = useState<DistribuicaoData>({});
  const [resultados, setResultados] = useState<ResultadoDistribuicao[]>([]);
  const [calculationInfo, setCalculationInfo] = useState<{
    totalMinutesPool: number;
    poolValue: number;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: barbeiros, isLoading: barbeirosLoading } = useQuery<Barbeiro[]>({
    queryKey: ["/api/barbeiros"],
  });

  const { data: servicosAssinatura, isLoading: servicosLoading } = useQuery<Servico[]>({
    queryKey: ["/api/servicos/assinatura"],
  });

  const calculateMutation = useMutation({
    mutationFn: (data: {
      faturamentoTotal: number;
      percentualComissao: number;
      distribuicaoData: DistribuicaoData;
    }) => apiRequest("POST", "/api/distribuicao/calcular", data),
    onSuccess: async (response) => {
      const result: CalculationResult = await response.json();
      setResultados(result.resultados);
      setCalculationInfo({
        totalMinutesPool: result.totalMinutesPool,
        poolValue: result.poolValue,
      });
      toast({
        title: "Cálculo realizado",
        description: "Distribuição de comissões calculada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro no cálculo",
        description: "Erro ao calcular distribuição de comissões",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: {
      periodoInicio: string;
      periodoFim: string;
      faturamentoTotal: number;
      percentualComissao: number;
      resultados: ResultadoDistribuicao[];
    }) => apiRequest("POST", "/api/distribuicao/salvar", data),
    onSuccess: () => {
      toast({
        title: "Distribuição salva",
        description: "Distribuição de comissões salva com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Erro ao salvar distribuição",
        variant: "destructive",
      });
    },
  });

  const handleQuantidadeChange = (barbeiroId: number, servicoId: number, quantidade: number) => {
    setDistribuicaoData(prev => ({
      ...prev,
      [barbeiroId]: {
        ...prev[barbeiroId],
        [servicoId]: quantidade || 0,
      },
    }));
  };

  const handleCalculate = () => {
    if (!barbeiros || !servicosAssinatura) return;

    const faturamento = parseFloat(faturamentoTotal);
    if (isNaN(faturamento) || faturamento <= 0) {
      toast({
        title: "Valor inválido",
        description: "Insira um valor válido para o faturamento total",
        variant: "destructive",
      });
      return;
    }

    calculateMutation.mutate({
      faturamentoTotal: faturamento,
      percentualComissao,
      distribuicaoData,
    });
  };

  const handleSave = () => {
    if (resultados.length === 0) {
      toast({
        title: "Nenhum resultado",
        description: "Calcule a distribuição antes de salvar",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      periodoInicio,
      periodoFim,
      faturamentoTotal: parseFloat(faturamentoTotal),
      percentualComissao,
      resultados,
    });
  };

  const handleExportCSV = () => {
    if (resultados.length === 0) {
      toast({
        title: "Nenhum resultado",
        description: "Calcule a distribuição antes de exportar",
        variant: "destructive",
      });
      return;
    }

    const csvHeader = "Barbeiro,Minutos Trabalhados,% Participação,Faturamento Proporcional,Comissão\n";
    const csvRows = resultados
      .map(r => 
        `${r.barbeiro.nome},${r.minutesWorked},${r.participationRate.toFixed(1)}%,${r.revenueShare.toFixed(2)},${r.commission.toFixed(2)}`
      )
      .join("\n");
    
    const csv = csvHeader + csvRows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `distribuicao-comissoes-${periodoInicio}-${periodoFim}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado",
      description: "Relatório exportado com sucesso",
    });
  };

  const getTotalMinutos = (barbeiroId: number) => {
    if (!servicosAssinatura) return 0;
    
    let total = 0;
    servicosAssinatura.forEach(servico => {
      const quantidade = distribuicaoData[barbeiroId]?.[servico.id] || 0;
      total += quantidade * servico.tempoMinutos;
    });
    return total;
  };

  if (barbeirosLoading || servicosLoading) {
    return (
      <div className="space-y-24">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <div className="flex space-x-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Distribuição de Comissões</h2>
          <p className="text-muted-foreground">Calcule e distribua comissões baseadas no tempo trabalhado</p>
        </div>
        
        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={resultados.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={handleSave}
            disabled={resultados.length === 0 || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Distribuição
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <Label htmlFor="periodoInicio">Data Início</Label>
              <Input
                id="periodoInicio"
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="periodoFim">Data Fim</Label>
              <Input
                id="periodoFim"
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="faturamentoTotal">Faturamento Total (R$)</Label>
              <Input
                id="faturamentoTotal"
                type="number"
                step="0.01"
                value={faturamentoTotal}
                onChange={(e) => setFaturamentoTotal(e.target.value)}
                placeholder="28450.00"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="percentualComissao">% Comissão</Label>
              <Input
                id="percentualComissao"
                type="number"
                min="0"
                max="100"
                value={percentualComissao}
                onChange={(e) => setPercentualComissao(parseInt(e.target.value) || 0)}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Points Distribution Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Grade de Distribuição de Pontos</CardTitle>
            <Button 
              onClick={handleCalculate}
              disabled={calculateMutation.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {calculateMutation.isPending ? "Calculando..." : "Calcular"}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Barbeiro</TableHead>
                  {servicosAssinatura?.map((servico) => (
                    <TableHead key={servico.id} className="text-center min-w-32">
                      <div className="space-y-1">
                        <div className="font-medium">{servico.nome}</div>
                        <div className="text-xs text-muted-foreground flex items-center justify-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {servico.tempoMinutos}min
                        </div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Total Minutos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barbeiros?.filter(b => b.ativo).map((barbeiro) => (
                  <TableRow key={barbeiro.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {getInitials(barbeiro.nome)}
                          </span>
                        </div>
                        <span className="font-medium">{barbeiro.nome}</span>
                      </div>
                    </TableCell>
                    {servicosAssinatura?.map((servico) => (
                      <TableCell key={servico.id} className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={distribuicaoData[barbeiro.id]?.[servico.id] || 0}
                          onChange={(e) => 
                            handleQuantidadeChange(
                              barbeiro.id, 
                              servico.id, 
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-medium">
                      {getTotalMinutos(barbeiro.id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultados da Distribuição</CardTitle>
            {calculationInfo && (
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <span>Total de minutos: {calculationInfo.totalMinutesPool}</span>
                <span>Pool de comissão: {formatCurrency(calculationInfo.poolValue)}</span>
              </div>
            )}
          </CardHeader>
          
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead className="text-center">Minutos Trabalhados</TableHead>
                    <TableHead className="text-center">% Participação</TableHead>
                    <TableHead className="text-center">Faturamento Proporcional</TableHead>
                    <TableHead className="text-center">Comissão ({percentualComissao}%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((resultado) => (
                    <TableRow key={resultado.barbeiro.id} className="hover:bg-accent">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {getInitials(resultado.barbeiro.nome)}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{resultado.barbeiro.nome}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium">{resultado.minutesWorked}</div>
                        <div className="text-xs text-muted-foreground">minutos</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium">{resultado.participationRate.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium">{formatCurrency(resultado.revenueShare)}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-bold text-green-600">
                          {formatCurrency(resultado.commission)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableRow className="bg-accent font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">
                    {resultados.reduce((sum, r) => sum + r.minutesWorked, 0)} min
                  </TableCell>
                  <TableCell className="text-center">100%</TableCell>
                  <TableCell className="text-center">
                    {formatCurrency(parseFloat(faturamentoTotal))}
                  </TableCell>
                  <TableCell className="text-center font-bold text-green-600">
                    {formatCurrency(resultados.reduce((sum, r) => sum + r.commission, 0))}
                  </TableCell>
                </TableRow>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
