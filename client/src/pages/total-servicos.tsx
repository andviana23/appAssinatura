import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, Filter, Calendar, TrendingUp, Users, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460'];

export default function Relatorios() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedBarbeiro, setSelectedBarbeiro] = useState("all");

  // Queries
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/analytics", selectedMonth, selectedBarbeiro],
    queryFn: () => apiRequest(`/api/analytics?mes=${selectedMonth}&barbeiro=${selectedBarbeiro}`),
  });

  const { data: barbeiros = [] } = useQuery({
    queryKey: ["/api/barbeiros"],
    queryFn: () => apiRequest("/api/barbeiros"),
  });

  const analytics = analyticsData || {
    atendimentosPorDia: [],
    servicosMaisFeitos: [],
    receitaPorDia: [],
    horasPorBarbeiro: [],
    comissaoMensal: [],
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]).join(',');
    const csvData = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${csvData}`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Relatórios</h1>
        <p className="text-gray-600">
          Relatórios detalhados e métricas de performance da barbearia
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-8 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#8B4513]" />
          <span className="text-sm font-medium text-[#8B4513]">Filtros:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthStr = date.toISOString().slice(0, 7);
                return (
                  <SelectItem key={monthStr} value={monthStr}>
                    {format(date, "MMMM yyyy", { locale: ptBR })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <Select value={selectedBarbeiro} onValueChange={setSelectedBarbeiro}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Barbeiros</SelectItem>
              {(barbeiros as any[]).filter(b => b.ativo).map((barbeiro: any) => (
                <SelectItem key={barbeiro.id} value={barbeiro.id.toString()}>
                  {barbeiro.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Atendimentos por Dia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#8B4513]">
              Atendimentos por Dia
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(analytics.atendimentosPorDia, 'atendimentos_por_dia')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.atendimentosPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#8B4513" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Serviços Mais Feitos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#8B4513]">
              Top 5 Serviços Mais Realizados
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(analytics.servicosMaisFeitos, 'servicos_mais_feitos')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.servicosMaisFeitos}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="quantidade"
                >
                  {analytics.servicosMaisFeitos.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Receita por Dia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#8B4513]">
              Receita de Assinatura por Dia
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(analytics.receitaPorDia, 'receita_por_dia')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.receitaPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Receita']} />
                <Line type="monotone" dataKey="valor" stroke="#8B4513" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Horas por Barbeiro */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#8B4513]">
              Horas Trabalhadas por Barbeiro
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(analytics.horasPorBarbeiro, 'horas_por_barbeiro')}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.horasPorBarbeiro} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="barbeiro" type="category" width={80} />
                <Tooltip formatter={(value) => [`${value}h`, 'Horas']} />
                <Bar dataKey="horas" fill="#A0522D" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Comissão Total Histórico */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#8B4513]">
            Comissão Total Pago (Histórico Mensal)
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(analytics.comissaoMensal, 'comissao_mensal')}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.comissaoMensal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Comissão Total']} />
              <Bar dataKey="valor" fill="#CD853F" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada - Horas por Barbeiro */}
      {analytics.horasPorBarbeiro.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#8B4513]">
              Detalhamento por Barbeiro - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-[#8B4513] text-white">
                    <th className="border border-gray-300 p-3 text-left">Barbeiro</th>
                    <th className="border border-gray-300 p-3 text-center">Horas Trabalhadas</th>
                    <th className="border border-gray-300 p-3 text-center">Atendimentos</th>
                    <th className="border border-gray-300 p-3 text-right">Faturamento</th>
                    <th className="border border-gray-300 p-3 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.horasPorBarbeiro.map((item: any, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className="border border-gray-300 p-3 font-medium">{item.barbeiro}</td>
                      <td className="border border-gray-300 p-3 text-center">{item.horas}h</td>
                      <td className="border border-gray-300 p-3 text-center">{item.atendimentos || 0}</td>
                      <td className="border border-gray-300 p-3 text-right">{formatCurrency(item.faturamento || 0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{formatCurrency(item.comissao || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}