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
  MoreVertical
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

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total de Clientes
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.consolidado?.totalClientes || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Receita Mensal
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : formatCurrency(estatisticas?.consolidado?.receitaTotal?.toString())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Conta Principal
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.asaasPrincipal?.assinaturasAtivas || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Database className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Conta Andrey
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {statsLoading ? "..." : estatisticas?.asaasAndrey?.assinaturasAtivas || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Busca */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome, email ou documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Origens</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="principal">Asaas Principal</SelectItem>
                  <SelectItem value="andrey">Asaas Andrey</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Clientes */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Clientes
              <Badge variant="secondary" className="ml-2">
                {clientesFiltrados.length} clientes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientesLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando clientes...</span>
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Nenhum cliente encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {clientesFiltrados.map((cliente: Cliente) => (
                  <div key={cliente.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                            {getInitials(cliente.nomeCompleto)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {cliente.nomeCompleto}
                            </h3>
                            <Badge className={getOrigemColor(cliente.origem)}>
                              {cliente.origem === 'LOCAL' ? 'Local' : 
                               cliente.origem === 'ASAAS_PRINCIPAL' ? 'Principal' : 'Andrey'}
                            </Badge>
                            {cliente.statusAssinatura && (
                              <Badge className={getStatusColor(cliente.statusAssinatura)}>
                                {cliente.statusAssinatura}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                            {cliente.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                <span className="truncate max-w-xs">{cliente.email}</span>
                              </div>
                            )}
                            {cliente.telefonePrincipal && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                <span>{cliente.telefonePrincipal}</span>
                              </div>
                            )}
                            {cliente.valorPlanoAtual && (
                              <div className="flex items-center gap-1">
                                <CreditCard className="h-4 w-4" />
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {formatCurrency(cliente.valorPlanoAtual)}
                                </span>
                              </div>
                            )}
                            {cliente.dataUltimoPagamento && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(cliente.dataUltimoPagamento)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}