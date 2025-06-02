import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  Filter,
  Clock,
  Star,
  Settings,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface ClientesStats {
  totalActiveClients: number;
  totalMonthlyRevenue: number;
  newClientsThisMonth: number;
  overdueClients: number;
}

export default function AdminDashboard() {
  // Estados para filtros de data - sempre usar mês atual
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState("");

  // Queries para dados do dashboard - sempre dados do mês atual
  const { data: clientesStats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/clientes-unified/stats'],
    refetchInterval: 300000,
  });

  const { data: dailyRevenue = [], isLoading: revenueLoading } = useQuery<any[]>({
    queryKey: ['/api/asaas/faturamento-diario'],
    refetchInterval: 300000,
  });

  // Query para KPIs baseados em dados reais do mês atual
  const { data: kpisDashboard, isLoading: kpisLoading } = useQuery<any>({
    queryKey: ['/api/analytics/kpis-dashboard', currentMonth, selectedDay],
    refetchInterval: 60000,
  });

  const { data: topServicos = [], isLoading: servicosLoading } = useQuery<any[]>({
    queryKey: ['/api/servicos/top-5', currentMonth],
    refetchInterval: 60000,
  });

  const { data: diasMovimento = [], isLoading: movimentoLoading } = useQuery<any[]>({
    queryKey: ['/api/analytics/dias-movimento', currentMonth],
    refetchInterval: 60000,
  });

  // Gerar opções de mês
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR })
    });
  }

  // Gerar opções de dia para o mês selecionado
  const dayOptions = [];
  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      dayOptions.push({
        value: day.toString().padStart(2, '0'),
        label: `Dia ${day}`
      });
    }
  }

  // Filtrar dados baseado nos filtros
  const filteredRevenue = dailyRevenue.filter(item => {
    if (!selectedMonth) return true;
    const itemDate = new Date(item.date);
    const [year, month] = selectedMonth.split('-');
    const matchesMonth = itemDate.getFullYear() === parseInt(year) && 
                        (itemDate.getMonth() + 1) === parseInt(month);
    
    if (selectedDay && selectedDay !== "todos") {
      return matchesMonth && itemDate.getDate() === parseInt(selectedDay);
    }
    return matchesMonth;
  });

  // Calcular KPIs baseados em dados reais do sistema
  const receitaTotal = kpisDashboard?.receitaTotal || 0;
  const totalAtendimentos = kpisDashboard?.totalAtendimentos || 0;
  const ticketMedio = kpisDashboard?.ticketMedio || 0;
  const tempoMedioPorAtendimento = kpisDashboard?.tempoMedioPorAtendimento || 0;
  const assinaturasVencidas = clientesStats?.overdueClients || 0;

  if (statsLoading) {
    return (
      <div className="space-y-6">
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

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header com Filtros */}
      <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard Executivo</h1>
            <p className="text-yellow-200">
              Dados do período: {selectedMonth && format(new Date(selectedMonth), "MMMM yyyy", { locale: ptBR })}
              {selectedDay && ` - Dia ${selectedDay}`}
            </p>
          </div>
          
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3">
              <Calendar className="h-4 w-4 text-white" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 border-white/30 text-white bg-transparent">
                  <SelectValue placeholder="Selecionar Mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3">
              <Filter className="h-4 w-4 text-white" />
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-32 border-white/30 text-white bg-transparent">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os dias</SelectItem>
                  {dayOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => {
                setSelectedMonth(format(new Date(), "yyyy-MM"));
                setSelectedDay("");
              }}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold"
            >
              Mês Atual
            </Button>

            <Button 
              onClick={() => window.location.href = '/gerenciar-fila'}
              className="bg-[#365e78] hover:bg-[#2a4a5e] text-white font-bold"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Fila
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Receita Total
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(receitaTotal)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Período selecionado
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Atendimentos
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalAtendimentos}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Users className="inline h-3 w-3 mr-1" />
                  Período selecionado
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Ticket Médio
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(ticketMedio)}
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  <Star className="inline h-3 w-3 mr-1" />
                  Por cliente
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`shadow-lg hover:shadow-xl transition-all duration-300 ${assinaturasVencidas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Assinaturas Vencidas
                </p>
                <p className={`text-2xl font-bold ${assinaturasVencidas > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {assinaturasVencidas}
                </p>
                <p className={`text-sm mt-1 ${assinaturasVencidas > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {assinaturasVencidas > 0 ? 'Requer atenção' : 'Tudo em dia'}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${assinaturasVencidas > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${assinaturasVencidas > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Faturamento */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#8B4513]" />
            Faturamento Diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), "dd/MM")}
                />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), "dd/MM/yyyy")}
                  formatter={(value) => [formatCurrency(value as number), "Faturamento"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8B4513" 
                  strokeWidth={3}
                  dot={{ fill: "#8B4513", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Seção de Análises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#1e3a8a]" />
              Dias de Maior Movimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movimentoLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : diasMovimento.length > 0 ? (
                diasMovimento.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{item.dia}</p>
                      <p className="text-sm text-gray-600">{item.atendimentos} atendimentos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1e3a8a]">{item.tempoTotal} min</p>
                      <p className="text-xs text-gray-500">Tempo total</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum movimento registrado no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[#1e3a8a]" />
              Top 5 Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {servicosLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : topServicos.length > 0 ? (
                topServicos.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{item.servico}</p>
                      <p className="text-sm text-gray-600">{item.quantidade} realizados</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1e3a8a]">{item.tempoTotal} min</p>
                      <p className="text-xs text-gray-500">Tempo total</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum serviço registrado no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}