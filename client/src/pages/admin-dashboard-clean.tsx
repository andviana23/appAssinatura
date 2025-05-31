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

export default function AdminDashboard() {
  const { data: clientesStats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ["/api/clientes/unified-stats"],
  });

  const { data: dailyRevenue = [], isLoading: dailyRevenueLoading } = useQuery<any[]>({
    queryKey: ["/api/asaas/faturamento-diario"],
  });

  const { data: ranking, isLoading: rankingLoading } = useQuery<any[]>({
    queryKey: ["/api/comissao/barbeiros"],
  });

  const { data: expiring, isLoading: expiringLoading } = useQuery<any[]>({
    queryKey: ["/api/clientes/expiring"],
  });

  if (statsLoading) {
    return (
      <div className="space-y-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
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

  // Calcular total de comissão de barbeiros (40% da receita de assinatura)
  const receitaAssinatura = clientesStats?.totalMonthlyRevenue || 0;
  const totalComissaoBarbeiros = receitaAssinatura * 0.4;

  return (
    <div className="space-y-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Receita de Assinatura
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(clientesStats?.totalMonthlyRevenue || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <DollarSign className="inline h-3 w-3 mr-1" />
                  Valor da aba Clientes
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
                  Clientes Ativos
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {clientesStats?.totalActiveClients || 0}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <CreditCard className="inline h-3 w-3 mr-1" />
                  Com assinaturas válidas
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Comissões (40%)
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalComissaoBarbeiros)}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Total do mês
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Em Atraso
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {clientesStats?.overdueClients || 0}
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

      {/* Gráfico de Faturamento */}
      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="text-lg">Faturamento Diário</CardTitle>
          <p className="text-sm text-muted-foreground">
            Receita dos últimos 30 dias baseada em pagamentos confirmados
          </p>
        </CardHeader>
        <CardContent>
          {dailyRevenueLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : dailyRevenue.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              Nenhum pagamento encontrado no período
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    className="text-xs"
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      name === 'value' ? 'Valor' : name
                    ]}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        {/* Ranking de Barbeiros */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Ranking de Barbeiros - Top 5
            </CardTitle>
            <Button variant="outline" size="sm">
              Ver Todos
            </Button>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : ranking && Array.isArray(ranking) && ranking.length > 0 ? (
              <div className="space-y-4">
                {ranking
                  .sort((a: any, b: any) => b.totalComissao - a.totalComissao)
                  .slice(0, 5)
                  .map((item: any, index: number) => (
                  <div 
                    key={item.barbeiro.id} 
                    className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#365e78] text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{item.barbeiro.nome}</div>
                        <div className="text-sm text-gray-600">{item.totalMinutos}min trabalhados</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {formatCurrency(item.totalComissao)}
                      </div>
                      <div className="text-xs text-gray-500">Comissão</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum dado de ranking disponível</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assinaturas Vencendo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Assinaturas Próximas ao Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : Array.isArray(expiring) && expiring.length > 0 ? (
              <div className="space-y-3">
                {expiring
                  .sort((a: any, b: any) => a.diasRestantes - b.diasRestantes)
                  .slice(0, 5)
                  .map((cliente: any) => (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-3 rounded-xl border-l-4 border-orange-500 bg-orange-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{cliente.nome}</div>
                      <div className="text-sm text-gray-600">{cliente.planoNome}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-orange-600">
                        {cliente.diasRestantes <= 0 ? 'Vencida' : `${cliente.diasRestantes} dias`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cliente.dataVencimentoAssinatura 
                          ? format(new Date(cliente.dataVencimentoAssinatura), "dd/MM", { locale: ptBR })
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma assinatura vencendo</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}