import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UserCheck, Calendar, DollarSign, RefreshCw, ExternalLink, CreditCard, ArrowLeft, Search, Users, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ClienteUnificado {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  planoNome: string;
  planoValor: number;
  formaPagamento: string;
  dataInicio: string;
  dataValidade: string;
  status: 'ATIVO' | 'INATIVO' | 'VENCIDO';
  origem: 'ASAAS' | 'EXTERNO';
  billingType?: string;
  daysRemaining?: number;
}

interface ClientesStats {
  totalActiveClients: number;
  totalInactiveClients: number;
  totalClients: number;
  monthlyPaidServicesRevenue: number; // Receita APENAS de serviços PAGOS no mês atual
  newClientsThisMonth: number;
  overdueClients: number;
  totalExternalClients: number;
  totalAsaasClients: number;
}

export default function Clientes() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo' | 'vencido'>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'asaas' | 'externo'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/clientes/unified-stats'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  const { data: clientes = [], isLoading: clientesLoading, refetch } = useQuery<ClienteUnificado[]>({
    queryKey: ['/api/clientes/all'], // Buscar TODOS os clientes
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  // Filtrar clientes localmente baseado nos filtros
  const clientesFiltrados = clientes.filter(cliente => {
    const matchStatus = filtroStatus === 'todos' || cliente.status.toLowerCase() === filtroStatus;
    const matchOrigem = filtroOrigem === 'todos' || cliente.origem.toLowerCase() === filtroOrigem;
    const matchSearch = searchTerm === '' || 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.telefone && cliente.telefone.includes(searchTerm));
    
    return matchStatus && matchOrigem && matchSearch;
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Dados atualizados",
        description: "Informações dos clientes foram sincronizadas",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível sincronizar os dados",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ATIVO: { label: "Ativo", variant: "default" as const, color: "bg-green-100 text-green-700 border-green-200" },
      INATIVO: { label: "Inativo", variant: "secondary" as const, color: "bg-gray-100 text-gray-700 border-gray-200" },
      VENCIDO: { label: "Vencido", variant: "destructive" as const, color: "bg-red-100 text-red-700 border-red-200" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INATIVO;
    return (
      <Badge className={`${config.color} border`}>
        {config.label}
      </Badge>
    );
  };

  const getOrigemIcon = (origem: string) => {
    if (origem === 'ASAAS') {
      return <CreditCard className="h-4 w-4 text-blue-500" />;
    }
    return <ExternalLink className="h-4 w-4 text-green-500" />;
  };

  const getOrigemLabel = (origem: string, formaPagamento: string) => {
    if (origem === 'ASAAS') {
      return `Asaas - ${formaPagamento}`;
    }
    return `Externo - ${formaPagamento}`;
  };

  const getDaysRemainingBadge = (daysRemaining?: number) => {
    if (!daysRemaining) return null;
    
    if (daysRemaining <= 7) {
      return <Badge className="bg-red-100 text-red-700 border-red-200 border">Vence em {daysRemaining}d</Badge>;
    } else if (daysRemaining <= 15) {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border">Vence em {daysRemaining}d</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">Vence em {daysRemaining}d</Badge>;
  };

  if (statsLoading && clientesLoading) {
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
              <h1 className="text-3xl font-bold text-gray-900">Gestão de Clientes</h1>
              <p className="text-gray-600 mt-1">Gerencie todos os clientes da barbearia de forma unificada</p>
            </div>
            
            <Button onClick={handleRefresh} className="bg-[#365e78] hover:bg-[#2a4a5e] text-white rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Dados
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-[#365e78]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? <Skeleton className="h-6 w-16" /> : (stats?.totalClients || clientes.length)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Todos os clientes cadastrados</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Clientes Ativos</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsLoading ? <Skeleton className="h-6 w-16" /> : (stats?.totalActiveClients || clientes.filter(c => c.status === 'ATIVO').length)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Com assinaturas válidas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Clientes Inativos</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {statsLoading ? <Skeleton className="h-6 w-16" /> : (stats?.totalInactiveClients || clientes.filter(c => c.status !== 'ATIVO').length)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Assinaturas vencidas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Receita Serviços Pagos</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#365e78]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#365e78]">
                {statsLoading ? <Skeleton className="h-6 w-20" /> : formatCurrency(stats?.monthlyPaidServicesRevenue || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Serviços pagos no mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-gray-200"
              />
            </div>
            
            <Select value={filtroStatus} onValueChange={(value) => setFiltroStatus(value as any)}>
              <SelectTrigger className="w-full lg:w-48 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filtroOrigem} onValueChange={(value) => setFiltroOrigem(value as any)}>
              <SelectTrigger className="w-full lg:w-48 rounded-xl">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Origens</SelectItem>
                <SelectItem value="asaas">Asaas</SelectItem>
                <SelectItem value="externo">Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span>Mostrando {clientesFiltrados.length} de {clientes.length} clientes</span>
            {(filtroStatus !== 'todos' || filtroOrigem !== 'todos' || searchTerm) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setFiltroStatus('todos');
                  setFiltroOrigem('todos');
                  setSearchTerm('');
                }}
                className="rounded-xl"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>

        {/* Tabela de Clientes */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Válido até</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente) => (
                    <TableRow key={cliente.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div>
                          <div className="font-semibold text-gray-900">{cliente.nome}</div>
                          <div className="text-sm text-gray-500">{cliente.email}</div>
                          {cliente.telefone && (
                            <div className="text-sm text-gray-500">{cliente.telefone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{cliente.planoNome}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(cliente.status)}
                          {getDaysRemainingBadge(cliente.daysRemaining)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getOrigemIcon(cliente.origem)}
                          <span className="text-sm">{getOrigemLabel(cliente.origem, cliente.formaPagamento)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{formatDate(cliente.dataValidade)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-[#365e78]">
                          {formatCurrency(cliente.planoValor)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {clientesFiltrados.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum cliente encontrado
                  </h3>
                  <p className="text-gray-500">
                    Ajuste os filtros ou tente uma busca diferente
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}