import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  DollarSign, 
  Clock, 
  Users,
  Calendar,
  Filter
} from "lucide-react";
import dayjs from "dayjs";

interface Barbeiro {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  comissao: number;
}

interface ComissaoStats {
  faturamentoTotalAssinatura: number;
  totalMinutosGerais: number;
  totalComissao: number;
}

export default function DistribuicaoNova() {
  const [dataInicio, setDataInicio] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dataFim, setDataFim] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  // Buscar dados dos barbeiros
  const { data: barbeiros = [] } = useQuery<Barbeiro[]>({
    queryKey: ['/api/barbeiros'],
  });

  // Buscar estatísticas de comissão com filtro de período
  const { data: comissaoStats = { faturamentoTotalAssinatura: 0, totalMinutosGerais: 0, totalComissao: 0 } } = useQuery<ComissaoStats>({
    queryKey: ['/api/comissao/stats', dataInicio, dataFim],
    queryFn: async () => {
      const response = await fetch(`/api/comissao/stats?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');
      return response.json();
    }
  });

  // Buscar ranking de barbeiros com filtro de período
  const { data: ranking = [] } = useQuery({
    queryKey: ['/api/comissao/barbeiros', dataInicio, dataFim],
    queryFn: async () => {
      const response = await fetch(`/api/comissao/barbeiros?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      if (!response.ok) throw new Error('Erro ao carregar ranking');
      return response.json();
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getPositionBadge = (position: number) => {
    const colors = {
      1: "bg-yellow-500 text-white",
      2: "bg-gray-400 text-white", 
      3: "bg-orange-600 text-white",
      4: "bg-blue-500 text-white",
      5: "bg-green-500 text-white"
    };
    return colors[position as keyof typeof colors] || "bg-gray-300 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Distribuição de Comissão</h1>
            <p className="text-gray-600 mt-2">Controle e distribuição das comissões por período e barbeiro</p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{dayjs().format("MMMM [de] YYYY")}</span>
          </div>
        </div>

        {/* Filtros de Período */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-xl flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filtros de Período
            </CardTitle>
            <CardDescription className="text-blue-100">
              Selecione o período para calcular as comissões
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <Label htmlFor="dataInicio" className="text-sm font-medium text-gray-700">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataFim" className="text-sm font-medium text-gray-700">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 h-10"
                onClick={() => {
                  // A query será refeita automaticamente quando as datas mudarem
                }}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Recalcular
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(comissaoStats.faturamentoTotalAssinatura)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Faturamento Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatHours(comissaoStats.totalMinutosGerais)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Total de Horas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(comissaoStats.totalComissao)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Total de Comissões</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Distribuição */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-xl">Distribuição por Barbeiro</CardTitle>
            <CardDescription className="text-blue-100">
              Ranking de performance e comissões no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              {/* Header da tabela */}
              <div className="grid grid-cols-5 gap-4 p-6 bg-gray-50 border-b font-semibold text-gray-700">
                <div>Barbeiro</div>
                <div className="text-center">Ranking</div>
                <div className="text-center">Faturamento</div>
                <div className="text-center">Horas Trabalhadas</div>
                <div className="text-center">Comissão</div>
              </div>

              {/* Linhas da tabela */}
              <div className="divide-y divide-gray-100">
                {ranking.map((item: any, index: number) => (
                  <div key={item.barbeiro.id} className="grid grid-cols-5 gap-4 p-6 hover:bg-gray-50 transition-colors">
                    {/* Barbeiro */}
                    <div>
                      <div className="font-semibold text-gray-900">{item.barbeiro.nome}</div>
                      <div className="text-sm text-gray-500">{item.barbeiro.email}</div>
                    </div>

                    {/* Ranking */}
                    <div className="text-center">
                      <Badge 
                        variant="outline" 
                        className={`${getPositionBadge(index + 1)} px-3 py-1 font-bold`}
                      >
                        {index + 1}º lugar
                      </Badge>
                    </div>

                    {/* Faturamento */}
                    <div className="text-center">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(item.faturamento)}
                      </span>
                    </div>

                    {/* Horas */}
                    <div className="text-center">
                      <span className="text-lg font-bold text-blue-600">
                        {formatHours(item.horas)}
                      </span>
                    </div>

                    {/* Comissão */}
                    <div className="text-center">
                      <span className="text-lg font-bold text-purple-600">
                        {formatCurrency(item.comissao)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {ranking.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum dado encontrado</p>
                  <p className="text-sm">Ajuste o período ou verifique se há atendimentos registrados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}