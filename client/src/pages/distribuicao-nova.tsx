import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator, 
  DollarSign, 
  Clock, 
  Users,
  Calendar,
  ArrowLeft,
  TrendingUp,
  CheckCircle,
  Award
} from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import dayjs from "dayjs";
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

interface BarbeiroComissao {
  barbeiro: {
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
  };
  servicos: any[];
  totalServicos: number;
  tempoTotalMinutos: number;
  comissaoTotal: number;
}

interface ServicosFinalizados {
  mes: string;
  barbeiros: BarbeiroComissao[];
  totalServicosFinalizados: number;
  receitaTotalServicos: number;
}

export default function DistribuicaoNova() {
  const [, setLocation] = useLocation();
  const [mesSelecionado, setMesSelecionado] = useState(dayjs().format('YYYY-MM'));

  const { data: servicosData, isLoading, refetch } = useQuery<ServicosFinalizados>({
    queryKey: ['/api/comissao/services-finished', mesSelecionado],
    queryFn: async () => {
      const response = await fetch(`/api/comissao/services-finished?mes=${mesSelecionado}`);
      if (!response.ok) throw new Error('Erro ao carregar serviços finalizados');
      return response.json();
    }
  });

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getRankingPosition = (barbeiros: BarbeiroComissao[], barbeiroId: number) => {
    const sorted = [...barbeiros].sort((a, b) => b.comissaoTotal - a.comissaoTotal);
    return sorted.findIndex(b => b.barbeiro.id === barbeiroId) + 1;
  };

  const getPositionBadge = (position: number) => {
    const colors = {
      1: "bg-yellow-500 text-white border-yellow-600",
      2: "bg-gray-400 text-white border-gray-500", 
      3: "bg-orange-600 text-white border-orange-700",
      4: "bg-blue-500 text-white border-blue-600",
      5: "bg-green-500 text-white border-green-600"
    };
    const color = colors[position as keyof typeof colors] || "bg-gray-300 text-gray-700 border-gray-400";
    
    return (
      <Badge className={`${color} border font-semibold`}>
        #{position}
      </Badge>
    );
  };

  const generateMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const month = dayjs().subtract(i, 'month');
      months.push({
        value: month.format('YYYY-MM'),
        label: month.format('MMMM [de] YYYY')
      });
    }
    return months;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-colors bg-[#365e78]/10 rounded-xl px-4 py-2 hover:bg-[#365e78]/20"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Comissões por Serviços Finalizados</h1>
              <p className="text-gray-600 mt-1">Acompanhe o desempenho e comissões baseados nos serviços efetivamente concluídos</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="w-64 rounded-xl bg-white/80">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => refetch()} 
                className="bg-[#365e78] hover:bg-[#2a4a5e] text-white rounded-xl"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Serviços Finalizados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {servicosData?.totalServicosFinalizados || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total de serviços concluídos</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-[#365e78]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#365e78]">
                {formatCurrency(servicosData?.receitaTotalServicos || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Receita dos serviços finalizados</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Barbeiros Ativos</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {servicosData?.barbeiros.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Profissionais com serviços</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Comissão Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  servicosData?.barbeiros.reduce((total, b) => total + b.comissaoTotal, 0) || 0
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total de comissões a pagar</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Comissões por Barbeiro */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Comissões por Barbeiro - {dayjs(mesSelecionado).format('MMMM [de] YYYY')}
                </CardTitle>
                <p className="text-gray-600 mt-1">Baseado nos serviços efetivamente finalizados</p>
              </div>
              <Award className="h-6 w-6 text-[#365e78]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ranking</TableHead>
                    <TableHead>Barbeiro</TableHead>
                    <TableHead>Serviços Finalizados</TableHead>
                    <TableHead>Tempo Trabalhado</TableHead>
                    <TableHead>Comissão Total</TableHead>
                    <TableHead>Média por Serviço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicosData?.barbeiros
                    .sort((a, b) => b.comissaoTotal - a.comissaoTotal)
                    .map((barbeiro, index) => (
                    <TableRow key={barbeiro.barbeiro.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        {getPositionBadge(index + 1)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold text-gray-900">{barbeiro.barbeiro.nome}</div>
                          <div className="text-sm text-gray-500">{barbeiro.barbeiro.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-semibold text-green-600">{barbeiro.totalServicos}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-600">{formatHours(barbeiro.tempoTotalMinutos)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-[#365e78] text-lg">
                          {formatCurrency(barbeiro.comissaoTotal)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-600">
                          {barbeiro.totalServicos > 0 
                            ? formatCurrency(barbeiro.comissaoTotal / barbeiro.totalServicos)
                            : formatCurrency(0)
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {!servicosData?.barbeiros.length && (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum serviço finalizado encontrado
                  </h3>
                  <p className="text-gray-500">
                    Não há serviços finalizados para o período selecionado
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Período */}
        {servicosData && servicosData.barbeiros.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Resumo do Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#365e78] mb-2">
                    {formatCurrency(servicosData.receitaTotalServicos)}
                  </div>
                  <p className="text-sm text-gray-600">Receita Total dos Serviços</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {formatCurrency(
                      servicosData.barbeiros.reduce((total, b) => total + b.comissaoTotal, 0)
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Total de Comissões</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {(
                      (servicosData.barbeiros.reduce((total, b) => total + b.comissaoTotal, 0) / 
                      servicosData.receitaTotalServicos) * 100
                    ).toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600">Percentual de Comissão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}