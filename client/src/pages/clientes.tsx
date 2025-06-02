import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserCheck, RefreshCw, Users, TrendingUp, AlertCircle, Filter, Search, ArrowLeft, MoreVertical, Ban, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClienteUnificado {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  planoNome: string | null;
  planoValor: string | null;
  formaPagamento: string | null;
  statusAssinatura: string | null;
  dataInicioAssinatura: Date | null;
  dataVencimentoAssinatura: Date | null;
  origem: 'ASAAS' | 'EXTERNO';
  createdAt: Date;
  dataProximaFatura?: string | null;
  cycle?: string | null;
}

interface ClientesStats {
  totalActiveClients: number;
  totalSubscriptionRevenue: number;
  totalExpiringSubscriptions: number;
}

interface ClienteAsaasAndrey {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  dataCadastro: string;
  origem: 'ASAAS_ANDREY';
  planoNome: string | null;
  planoValor: number | null;
  formaPagamento: string | null;
  statusAssinatura: string | null;
  dataProximaFatura: string | null;
  cycle: string | null;
}

export default function Clientes() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Estados para filtros de data
  const currentDate = new Date();
  const [filtroMes, setFiltroMes] = useState<string>((currentDate.getMonth() + 1).toString().padStart(2, '0'));
  const [filtroAno, setFiltroAno] = useState<string>(currentDate.getFullYear().toString());
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [buscaNome, setBuscaNome] = useState<string>('');
  const [abaAtiva, setAbaAtiva] = useState<string>('principal');

  const { data: stats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/clientes-unified/stats', filtroMes, filtroAno],
    refetchInterval: 300000,
  });

  const { data: clientes = [], isLoading: clientesLoading, refetch } = useQuery<ClienteUnificado[]>({
    queryKey: ['/api/clientes-unified'],
    refetchInterval: 300000,
  });

  // Hook para buscar clientes da segunda conta Asaas (Andrey)
  const { data: clientesAndrey, isLoading: clientesAndreyLoading, refetch: refetchAndrey } = useQuery<{success: boolean, total: number, clientes: ClienteAsaasAndrey[]}>({
    queryKey: ['/api/clientes-asaas-andrey'],
    refetchInterval: 300000,
    enabled: abaAtiva === 'andrey',
  });

  // Filtrar clientes baseado nos filtros selecionados
  const clientesFiltrados = clientes.filter(cliente => {
    // Filtro por origem
    const matchOrigem = filtroOrigem === 'todos' || cliente.origem.toLowerCase() === filtroOrigem;
    
    // Filtro por nome (busca)
    const matchNome = buscaNome === '' || 
      cliente.nome.toLowerCase().includes(buscaNome.toLowerCase()) ||
      cliente.email.toLowerCase().includes(buscaNome.toLowerCase());
    
    // Filtro por data de cadastro/pagamento
    const dataReferencia = cliente.dataInicioAssinatura || cliente.createdAt;
    if (dataReferencia) {
      const dataCliente = new Date(dataReferencia);
      const mesCliente = (dataCliente.getMonth() + 1).toString().padStart(2, '0');
      const anoCliente = dataCliente.getFullYear().toString();
      
      const matchData = mesCliente === filtroMes && anoCliente === filtroAno;
      return matchOrigem && matchNome && matchData;
    }
    
    return matchOrigem && matchNome;
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      await refetchAndrey();
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-unified/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-asaas-andrey'] });
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

  // Mutations para cancelar e excluir assinaturas
  const cancelarAssinaturaMutation = useMutation({
    mutationFn: async ({ clienteId, origem }: { clienteId: number; origem: 'ASAAS' | 'EXTERNO' }) => {
      const endpoint = origem === 'EXTERNO' 
        ? `/api/assinaturas-externas/${clienteId}/cancelar`
        : `/api/assinaturas-asaas/${clienteId}/cancelar`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao cancelar assinatura');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-unified'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-unified/stats'] });
      toast({
        title: "Assinatura cancelada",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const excluirAssinaturaMutation = useMutation({
    mutationFn: async ({ clienteId, origem }: { clienteId: number; origem: 'ASAAS' | 'EXTERNO' }) => {
      const endpoint = origem === 'EXTERNO' 
        ? `/api/assinaturas-externas/${clienteId}/excluir`
        : `/api/assinaturas-asaas/${clienteId}/excluir`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao excluir assinatura');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-unified'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes-unified/stats'] });
      toast({
        title: "Assinatura excluída",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelarAssinatura = (cliente: ClienteUnificado) => {
    cancelarAssinaturaMutation.mutate({
      clienteId: cliente.id,
      origem: cliente.origem,
    });
  };

  const handleExcluirAssinatura = (cliente: ClienteUnificado) => {
    excluirAssinaturaMutation.mutate({
      clienteId: cliente.id,
      origem: cliente.origem,
    });
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              size="sm"
              className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
              <p className="text-gray-600 mt-1">
                Gerencie clientes e assinaturas do sistema
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
            >
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
                {statsLoading ? <Skeleton className="h-6 w-16" /> : clientes.length}
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
                {statsLoading ? <Skeleton className="h-6 w-16" /> : (stats?.totalActiveClients || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Com assinaturas válidas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Expirando em Breve</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {statsLoading ? <Skeleton className="h-6 w-16" /> : (stats?.totalExpiringSubscriptions || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Próximos 7 dias</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Receita de Assinaturas</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#365e78]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#365e78]">
                {statsLoading ? <Skeleton className="h-6 w-20" /> : formatCurrency(stats?.totalSubscriptionRevenue || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Assinaturas ativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Abas para separar os clientes */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="principal">Clientes Principal</TabsTrigger>
            <TabsTrigger value="andrey">Clientes Asaas Andrey</TabsTrigger>
          </TabsList>

          {/* Aba Principal - Clientes existentes */}
          <TabsContent value="principal" className="space-y-6">
            {/* Filtros */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
          <CardContent>
            {/* Barra de Busca */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Buscar Cliente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Digite o nome ou email do cliente..."
                  value={buscaNome}
                  onChange={(e) => setBuscaNome(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtros de Data e Origem */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mês</label>
                <Select value={filtroMes} onValueChange={setFiltroMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">Janeiro</SelectItem>
                    <SelectItem value="02">Fevereiro</SelectItem>
                    <SelectItem value="03">Março</SelectItem>
                    <SelectItem value="04">Abril</SelectItem>
                    <SelectItem value="05">Maio</SelectItem>
                    <SelectItem value="06">Junho</SelectItem>
                    <SelectItem value="07">Julho</SelectItem>
                    <SelectItem value="08">Agosto</SelectItem>
                    <SelectItem value="09">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Ano</label>
                <Select value={filtroAno} onValueChange={setFiltroAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Origem</label>
                <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="asaas">Asaas</SelectItem>
                    <SelectItem value="externo">Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Lista de Clientes ({clientesFiltrados.length} de {clientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientesLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : (
                clientesFiltrados.map((cliente) => (
                  <div key={cliente.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
                          <div className="flex items-center gap-2">
                            {cliente.statusAssinatura === 'ATIVO' ? (
                              <Badge variant="default" className="bg-green-100 text-green-800 text-xs">ATIVO</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">SEM ASSINATURA</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">ASAAS PRINCIPAL</Badge>
                            {cliente.planoValor && parseFloat(cliente.planoValor) > 0 && (
                              <span className="text-sm font-semibold text-gray-900">
                                R$ {parseFloat(cliente.planoValor).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{cliente.email}</p>
                        {cliente.telefone && (
                          <p className="text-sm text-gray-500">Telefone: {cliente.telefone}</p>
                        )}
                        {cliente.cpf && (
                          <p className="text-sm text-gray-500">CPF: {cliente.cpf}</p>
                        )}
                        
                        {cliente.planoNome && (
                          <div className="mt-2 text-sm text-gray-600">
                            <strong>Plano:</strong> {cliente.planoNome} | <strong>Pagamento:</strong> {cliente.formaPagamento}
                          </div>
                        )}
                        
                        {cliente.dataVencimentoAssinatura && (
                          <div className="text-sm text-gray-600">
                            <strong>Próxima fatura:</strong> {new Date(cliente.dataVencimentoAssinatura).toLocaleDateString()}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Cadastrado: {new Date(cliente.createdAt).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        
                        {/* Menu de Ações */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {cliente.statusAssinatura === 'ATIVO' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Cancelar Assinatura
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja cancelar a assinatura de {cliente.nome}? 
                                      A assinatura permanecerá ativa até a data de vencimento.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancelarAssinatura(cliente)}
                                      disabled={cancelarAssinaturaMutation.isPending}
                                    >
                                      {cancelarAssinaturaMutation.isPending ? "Cancelando..." : "Confirmar"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                  <span className="text-red-500">Excluir Permanentemente</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Assinatura</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>ATENÇÃO:</strong> Esta ação é irreversível! 
                                    Todos os dados de {cliente.nome} serão excluídos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleExcluirAssinatura(cliente)}
                                    disabled={excluirAssinaturaMutation.isPending}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    {excluirAssinaturaMutation.isPending ? "Excluindo..." : "Excluir"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Plano:</strong> {cliente.planoNome || 'N/A'} | 
                      <strong> Pagamento:</strong> {cliente.formaPagamento || 'N/A'}
                    </div>
                  </div>
                ))
              )}
              
              {clientesFiltrados.length === 0 && !clientesLoading && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum cliente encontrado
                  </h3>
                  <p className="text-gray-500">
                    {clientes.length === 0 
                      ? "Os clientes aparecerão aqui quando forem cadastrados"
                      : "Ajuste os filtros para encontrar os clientes desejados"
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Aba Clientes Asaas Andrey */}
          <TabsContent value="andrey" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Clientes Asaas Andrey
                  <Badge variant="secondary" className="ml-2">
                    {clientesAndrey?.total || 0} clientes
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientesAndreyLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-64 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    ))}
                  </div>
                ) : clientesAndrey?.success && clientesAndrey.clientes.length > 0 ? (
                  <div className="space-y-4">
                    {clientesAndrey.clientes.map((cliente) => (
                      <div key={cliente.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
                              <div className="flex items-center gap-2">
                                {cliente.statusAssinatura === 'ATIVO' ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800 text-xs">ATIVO</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">SEM ASSINATURA</Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">ASAAS ANDREY</Badge>
                                {cliente.planoValor && (
                                  <span className="text-sm font-semibold text-gray-900">
                                    R$ {cliente.planoValor.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{cliente.email}</p>
                            {cliente.telefone && (
                              <p className="text-sm text-gray-500">Telefone: {cliente.telefone}</p>
                            )}
                            {cliente.cpf && (
                              <p className="text-sm text-gray-500">CPF: {cliente.cpf}</p>
                            )}
                            
                            {cliente.planoNome && (
                              <div className="mt-2 text-sm text-gray-600">
                                <strong>Plano:</strong> {cliente.planoNome} | <strong>Pagamento:</strong> {cliente.formaPagamento}
                              </div>
                            )}
                            
                            {cliente.dataProximaFatura && (
                              <div className="text-sm text-gray-600">
                                <strong>Próxima fatura:</strong> {new Date(cliente.dataProximaFatura).toLocaleDateString()}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 mt-2">
                              <Badge variant="outline" className="text-xs">
                                Cadastrado: {new Date(cliente.dataCadastro).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Exportar dados
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <UserCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum cliente encontrado
                    </h3>
                    <p className="text-gray-500">
                      Não há clientes cadastrados na conta Asaas Andrey
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}