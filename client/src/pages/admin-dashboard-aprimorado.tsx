import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  CreditCard,
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  Crown,
  Medal,
  Trophy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface ClientesStats {
  totalActiveClients: number;
  totalMonthlyRevenue: number;
  newClientsThisMonth: number;
  overdueClients: number;
  totalExternalClients: number;
  totalAsaasClients: number;
}

interface BarbeiroRanking {
  barbeiro: {
    id: number;
    nome: string;
    email: string;
  };
  faturamento: number;
  comissao: number;
  horas: number;
}

interface AssinaturaVencendo {
  id: string;
  nome: string;
  email: string;
  planoNome: string;
  planoValor: string;
  dataVencimentoAssinatura: string;
  diasRestantes: number;
}

export default function AdminDashboardAprimorado() {
  const { data: clientesStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/clientes/unified-stats"],
  });

  const { data: ranking, isLoading: rankingLoading } = useQuery({
    queryKey: ["/api/dashboard/ranking"],
  });

  const { data: assinaturasVencendo, isLoading: vencendoLoading } = useQuery({
    queryKey: ["/api/clientes/expiring"],
  });

  const { data: faturamentoDiario, isLoading: faturamentoLoading } = useQuery({
    queryKey: ["/api/asaas/faturamento-diario"],
  });

  if (statsLoading || rankingLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalComissaoBarbeiros = (clientesStats?.totalMonthlyRevenue || 0) * 0.4;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Dashboard Administrativo</h1>
        <p className="text-gray-600">
          Visão geral completa da performance da barbearia
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Receita Mensal
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(clientesStats?.totalMonthlyRevenue || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Assinaturas ativas
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Clientes Ativos
                </p>
                <p className="text-2xl font-bold text-[#8B4513]">
                  {clientesStats?.totalActiveClients || 0}
                </p>
                <p className="text-sm text-[#8B4513] mt-1">
                  <Users className="inline h-3 w-3 mr-1" />
                  Com assinaturas válidas
                </p>
              </div>
              <div className="h-12 w-12 bg-[#8B4513]/10 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-[#8B4513]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Comissões Totais
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalComissaoBarbeiros)}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  40% da receita
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Vencendo Hoje
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {Array.isArray(assinaturasVencendo) 
                    ? assinaturasVencendo.filter(a => a.diasRestantes <= 0).length 
                    : 0}
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  Necessitam atenção
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ranking de Barbeiros - Top 5 */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-[#8B4513] flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
              Top 5 Barbeiros - Ranking de Comissão
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              className="hover:scale-105 transition-transform hover:bg-[#8B4513] hover:text-white"
            >
              Ver Ranking Completo
            </Button>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                ))}
              </div>
            ) : ranking && Array.isArray(ranking) && ranking.length > 0 ? (
              <div className="space-y-4">
                {ranking
                  .sort((a, b) => b.comissao - a.comissao)
                  .slice(0, 5)
                  .map((item, index) => (
                  <div 
                    key={item.barbeiro.id} 
                    className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 hover:shadow-md transition-all duration-200 hover:scale-102"
                  >
                    <div className="flex items-center space-x-4">
                      {/* Posição no ranking */}
                      <div className={`
                        flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-sm
                        ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white' : 
                          index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white' : 
                          index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white' :
                          'bg-gradient-to-r from-blue-400 to-blue-500 text-white'}
                      `}>
                        {index === 0 ? <Crown className="h-5 w-5" /> : 
                         index === 1 ? <Medal className="h-5 w-5" /> :
                         index === 2 ? <Trophy className="h-4 w-4" /> : `${index + 1}°`}
                      </div>
                      
                      {/* Avatar do barbeiro */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#8B4513] text-white font-semibold text-lg shadow-md">
                        {getInitials(item.barbeiro.nome)}
                      </div>
                      
                      {/* Informações do barbeiro */}
                      <div>
                        <div className="font-bold text-gray-900 text-lg">{item.barbeiro.nome}</div>
                        <div className="text-sm text-gray-600">
                          {item.horas}h trabalhadas • Faturamento: {formatCurrency(item.faturamento)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Comissão */}
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-xl">
                        {formatCurrency(item.comissao)}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Comissão
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Trophy className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Nenhum dado de ranking disponível</p>
                <p className="text-sm">Os dados aparecerão quando houver atendimentos registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assinaturas Próximas ao Vencimento */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#8B4513] flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Próximas ao Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vencendoLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : Array.isArray(assinaturasVencendo) && assinaturasVencendo.length > 0 ? (
              <div className="space-y-4">
                {assinaturasVencendo
                  .sort((a, b) => a.diasRestantes - b.diasRestantes)
                  .slice(0, 5)
                  .map((cliente) => (
                  <div
                    key={cliente.id}
                    className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-shadow ${
                      cliente.diasRestantes <= 0 
                        ? 'bg-red-50 border-red-500' 
                        : cliente.diasRestantes <= 3
                        ? 'bg-orange-50 border-orange-500'
                        : 'bg-yellow-50 border-yellow-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{cliente.nome}</div>
                        <div className="text-sm text-gray-600">{cliente.planoNome}</div>
                        <div className="text-xs text-gray-500">{cliente.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(cliente.planoValor)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {cliente.dataVencimentoAssinatura
                            ? format(new Date(cliente.dataVencimentoAssinatura), "dd/MM", { locale: ptBR })
                            : 'N/A'
                          }
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge 
                        className={
                          cliente.diasRestantes <= 0 
                            ? 'bg-red-100 text-red-800' 
                            : cliente.diasRestantes <= 3
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {cliente.diasRestantes <= 0 
                          ? 'Vencida' 
                          : `${cliente.diasRestantes} dias`
                        }
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">Nenhuma assinatura vencendo</p>
                <p className="text-sm">Tudo está em dia!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Faturamento */}
      {faturamentoDiario && Array.isArray(faturamentoDiario) && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#8B4513]">
              Faturamento dos Últimos 30 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={faturamentoDiario}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(Number(value)), 'Faturamento']}
                    labelStyle={{ color: '#8B4513' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8B4513" 
                    strokeWidth={3}
                    dot={{ fill: '#8B4513', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#8B4513', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}