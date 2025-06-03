import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Search, 
  Filter, 
  RefreshCw, 
  Phone, 
  Mail, 
  CreditCard, 
  Calendar,
  TrendingUp,
  Database,
  Eye,
  Download,
  MoreVertical,
  FileText,
  MapPin,
  Clock
} from "lucide-react";
import { useState, useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Cliente {
  id: number;
  nomeCompleto: string;
  email?: string;
  telefonePrincipal?: string;
  numeroDocumento?: string;
  valorPlanoAtual?: string;
  statusAssinatura?: string;
  dataUltimoPagamento?: string;
  origem: string;
  idAsaasPrincipal?: string;
  idAsaasAndrey?: string;
  cidade?: string;
  estado?: string;
  createdAt: string;
}

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterOrigem, setFilterOrigem] = useState("todas");
  const [selectedTab, setSelectedTab] = useState("lista");
  const queryClient = useQueryClient();

  // Buscar estatísticas consolidadas
  const { data: estatisticas, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/v2/estatisticas"],
    refetchInterval: 30000,
  });

  // Buscar todos os clientes
  const { data: clientesData, isLoading: clientesLoading } = useQuery({
    queryKey: ["/api/v2/clientes"],
  });

  // Mutations para sincronização
  const syncPrincipalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v2/sync/asaas-principal", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/estatisticas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/clientes"] });
    },
  });

  const syncAndreyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v2/sync/asaas-andrey", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/estatisticas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/clientes"] });
    },
  });

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    if (!clientesData?.clientes) return [];
    
    return clientesData.clientes.filter((cliente: Cliente) => {
      const matchSearch = !searchTerm || 
        cliente.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.numeroDocumento?.includes(searchTerm);
      
      const matchStatus = filterStatus === "todos" || 
        (filterStatus === "ativo" && (cliente.statusAssinatura === "ATIVO" || cliente.statusDescricao === "Cliente Ativo")) ||
        (filterStatus === "inativo" && (cliente.statusAssinatura !== "ATIVO" && cliente.statusDescricao !== "Cliente Ativo"));
      
      const matchOrigem = filterOrigem === "todas" || 
        (filterOrigem === "local" && cliente.origem === "LOCAL") ||
        (filterOrigem === "principal" && cliente.origem === "ASAAS_PRINCIPAL") ||
        (filterOrigem === "andrey" && cliente.origem === "ASAAS_ANDREY");
      
      return matchSearch && matchStatus && matchOrigem;
    });
  }, [clientesData?.clientes, searchTerm, filterStatus, filterOrigem]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ATIVO":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "CANCELADO":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "PAUSADO":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getOrigemColor = (origem: string) => {
    switch (origem) {
      case "LOCAL":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "ASAAS_PRINCIPAL":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "ASAAS_ANDREY":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const formatCurrency = (value?: string) => {
    if (!value) return "R$ 0,00";
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Gestão de Clientes
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Visualize e gerencie todos os clientes de todas as fontes
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => syncPrincipalMutation.mutate()}
              disabled={syncPrincipalMutation.isPending}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncPrincipalMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Principal
            </Button>
            <Button
              onClick={() => syncAndreyMutation.mutate()}
              disabled={syncAndreyMutation.isPending}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncAndreyMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Andrey
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas Modernos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Total de Clientes */}
          <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total de Clientes
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.consolidado?.totalClientes || 0}
                  </p>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                      Ativos: {clientesData?.clientes?.filter(c => c.status === 'ATIVO').length || 0}
                    </span>
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full font-medium">
                      Vencidos: {clientesData?.clientes?.filter(c => c.status === 'VENCIDO').length || 0}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receita Total */}
          <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-900 dark:to-green-900/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Receita Total
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : formatCurrency(estatisticas?.consolidado?.receitaTotal?.toString())}
                  </p>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full font-medium">
                      Cobranças Confirmadas
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conta Trato de Barbados */}
          <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Conta Trato de Barbados
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.asaasPrincipal?.clientesComCobrancas || 0}
                  </p>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                      Asaas Principal
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conta Andrey */}
          <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-br from-white to-orange-50/30 dark:from-gray-900 dark:to-orange-900/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Conta Andrey
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.asaasAndrey?.clientesComCobrancas || 0}
                  </p>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full font-medium">
                      Asaas Andrey
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Database className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Busca Modernos */}
        <Card className="border border-gray-200/60 dark:border-gray-700/60 shadow-lg bg-gradient-to-r from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-44 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="ativo">🟢 Ativos</SelectItem>
                    <SelectItem value="inativo">🟡 Vencidos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger className="w-44 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Filtrar por Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Origens</SelectItem>
                    <SelectItem value="principal">🏢 Asaas Trato</SelectItem>
                    <SelectItem value="andrey">🏢 Asaas Andrey</SelectItem>
                    <SelectItem value="local">💳 Pagamentos Externos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes Moderna */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Lista de Clientes
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {clientesFiltrados.length} clientes encontrados
                </p>
              </div>
            </div>
          </div>

          {clientesLoading ? (
            <Card className="border border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-3" />
                <span className="text-gray-600 dark:text-gray-400">Carregando clientes...</span>
              </CardContent>
            </Card>
          ) : clientesFiltrados.length === 0 ? (
            <Card className="border border-gray-200/60 dark:border-gray-700/60">
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Nenhum cliente encontrado
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Tente ajustar os filtros ou adicionar novos clientes
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {clientesFiltrados.map((cliente: Cliente) => (
                <Card key={cliente.id} className="group hover:shadow-lg transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-white to-gray-50/30 dark:from-gray-900 dark:to-gray-800/30">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* Informações Principais */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <Avatar className="h-14 w-14 ring-2 ring-gray-200 dark:ring-gray-700">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                            {getInitials(cliente.nomeCompleto)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          {/* Nome e Status */}
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">
                              {cliente.nomeCompleto}
                            </h3>
                            
                            {/* Status do Cliente */}
                            {cliente.statusAssinatura === 'ATIVO' && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                                🟢 Ativo
                              </Badge>
                            )}
                            {cliente.statusAssinatura === 'CANCELADO' && (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800">
                                🔴 Cancelado
                              </Badge>
                            )}
                            {(!cliente.statusAssinatura || cliente.statusAssinatura === 'VENCIDO') && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                                🟡 Vencido
                              </Badge>
                            )}
                            
                            {/* Origem do Pagamento */}
                            {cliente.origem === 'ASAAS_TRATO' && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                🏢 Asaas Trato
                              </Badge>
                            )}
                            {cliente.origem === 'ASAAS_ANDREY' && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                                🏢 Asaas Andrey
                              </Badge>
                            )}
                            {cliente.origem === 'LOCAL' && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                💳 Externo
                              </Badge>
                            )}
                          </div>
                          
                          {/* Informações de Contato */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
                            {cliente.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{cliente.email}</span>
                              </div>
                            )}
                            {cliente.telefonePrincipal && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{cliente.telefonePrincipal}</span>
                              </div>
                            )}
                            {cliente.numeroDocumento && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span>{cliente.numeroDocumento}</span>
                              </div>
                            )}
                            {cliente.cidade && cliente.estado && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span>{cliente.cidade}, {cliente.estado}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Informações Financeiras */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {cliente.valorPlanoAtual && (
                              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <div>
                                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Valor Mensal</p>
                                  <p className="font-bold text-green-700 dark:text-green-300">
                                    {formatCurrency(cliente.valorPlanoAtual)}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {cliente.dataUltimoPagamento && (
                              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <div>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Último Pagamento</p>
                                  <p className="font-bold text-blue-700 dark:text-blue-300">
                                    {formatDate(cliente.dataUltimoPagamento)}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Próxima Cobrança (apenas se for nos próximos 31 dias) */}
                            {(() => {
                              const proximaCobranca = calcularProximaCobranca(cliente.dataUltimoPagamento);
                              const diasRestantes = proximaCobranca ? Math.ceil((new Date(proximaCobranca).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                              
                              if (proximaCobranca && diasRestantes !== null && diasRestantes <= 31 && diasRestantes >= 0) {
                                return (
                                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    <div>
                                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Próxima Cobrança</p>
                                      <p className="font-bold text-amber-700 dark:text-amber-300">
                                        {diasRestantes === 0 ? 'Hoje' : diasRestantes === 1 ? 'Amanhã' : `${diasRestantes} dias`}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      {/* Menu de Ações */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar Dados
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}