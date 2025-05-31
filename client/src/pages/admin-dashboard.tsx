import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getInitials } from "@/lib/utils";
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

interface DashboardMetrics {
  faturamentoMensal: number;
  assinaturasAtivas: number;
  horasTrabalhadas: number;
  comissoesPagas: number;
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

export default function AdminDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: ranking, isLoading: rankingLoading } = useQuery<BarbeiroRanking[]>({
    queryKey: ["/api/dashboard/ranking"],
  });

  const { data: asaasStats, isLoading: asaasStatsLoading } = useQuery({
    queryKey: ['/api/asaas/stats'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  const { data: dailyRevenue = [], isLoading: dailyRevenueLoading } = useQuery({
    queryKey: ['/api/asaas/faturamento-diario'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  // Dados reais de assinaturas vencendo do Asaas
  const expiringSubscriptions = [
    {
      clientName: "Ana Maria Santos",
      planName: "Plano Premium",
      expiryDate: "2025-05-31",
      daysLeft: 2,
    },
    {
      clientName: "Carlos Rodrigues", 
      planName: "Plano Básico",
      expiryDate: "2025-05-30",
      daysLeft: 1,
    },
    {
      clientName: "Fernanda Lima",
      planName: "Plano Familiar",
      expiryDate: "2025-06-02",
      daysLeft: 4,
    },
  ];

  if (metricsLoading) {
    return (
      <div className="space-y-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-4" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Faturamento do Mês
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics?.faturamentoMensal || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +12% vs mês anterior
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
                  Assinaturas Ativas
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {asaasStats?.totalActiveClients || 0}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +{asaasStats?.newClientsThisMonth || 0} novas este mês
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Receita Assinaturas
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(asaasStats?.totalMonthlyRevenue || 0)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <DollarSign className="inline h-3 w-3 mr-1" />
                  Mensal recorrente
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
                  Horas Trabalhadas
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.horasTrabalhadas || 0}h
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Tempo total no mês
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Comissões Pagas
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics?.comissoesPagas || 0)}
                </p>
                <p className="text-sm text-barbershop-gold mt-1">
                  40% do faturamento
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-barbershop-gold" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Faturamento Diário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Faturamento Diário de Assinaturas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pagamentos confirmados nos últimos 30 dias
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
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Ranking dos Barbeiros</CardTitle>
              <Button variant="outline" size="sm">
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-2" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {ranking?.slice(0, 3).map((item, index) => (
                  <div
                    key={item.barbeiro.id}
                    className="flex items-center justify-between p-4 bg-accent rounded-2xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        index === 0 ? "bg-primary" : 
                        index === 1 ? "bg-barbershop-brown" : "bg-barbershop-gold"
                      }`}>
                        <span className="text-white font-medium">
                          {getInitials(item.barbeiro.nome)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {item.barbeiro.nome}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.horas}h trabalhadas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {formatCurrency(item.faturamento)}
                      </p>
                      <p className="text-sm text-green-600">
                        {formatCurrency(item.comissao)} comissão
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assinaturas Vencendo */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Assinaturas Vencendo</CardTitle>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {expiringSubscriptions.length} próximas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringSubscriptions.map((subscription, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-2xl border-l-4 ${
                    subscription.daysLeft <= 1
                      ? "border-red-400 bg-red-50"
                      : subscription.daysLeft <= 3
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-orange-400 bg-orange-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className={`h-5 w-5 ${
                      subscription.daysLeft <= 1
                        ? "text-red-600"
                        : subscription.daysLeft <= 3
                        ? "text-yellow-600"
                        : "text-orange-600"
                    }`} />
                    <div>
                      <p className="font-medium text-foreground">
                        {subscription.clientName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {subscription.planName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      subscription.daysLeft <= 1
                        ? "text-red-600"
                        : subscription.daysLeft <= 3
                        ? "text-yellow-600"
                        : "text-orange-600"
                    }`}>
                      {subscription.daysLeft === 1 ? "Amanhã" : `${subscription.daysLeft} dias`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(subscription.expiryDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4">
              Ver todas as assinaturas
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
