import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { useState, useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  id: number;
  nome: string;
  nomeCompleto?: string;
  email?: string;
  telefone?: string;
  telefonePrincipal?: string;
  cpf?: string;
  numeroDocumento?: string;
  planoNome?: string;
  planoValor?: string;
  valorPlanoAtual?: string;
  formaPagamento?: string;
  statusAssinatura?: string;
  dataInicioAssinatura?: string;
  dataVencimentoAssinatura?: string;
  dataUltimoPagamento?: string;
  origem: string;
  asaasCustomerId?: string;
  idAsaasPrincipal?: string;
  idAsaasAndrey?: string;
  cidade?: string;
  estado?: string;
  createdAt: string;
  observacoes?: string;
}

interface ClienteExterno {
  id: number;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  planoNome: string;
  planoValor: string;
  formaPagamento: string;
  statusAssinatura?: string;
  dataInicioAssinatura: string;
  dataVencimentoAssinatura: string;
  origem: string;
  createdAt: string;
  observacoes?: string;
}

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterOrigem, setFilterOrigem] = useState("todas");
  const [selectedTab, setSelectedTab] = useState("todos");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Buscar estatísticas consolidadas
  const { data: estatisticas, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/v2/estatisticas"],
    refetchInterval: 30000,
  });

  // Buscar clientes unificados (Asaas + Externos)
  const { data: clientesUnificados, isLoading: clientesLoading } = useQuery({
    queryKey: ["/api/clientes/unified"],
    refetchInterval: 60000,
  });

  // Buscar clientes externos
  const { data: clientesExternos, isLoading: externosLoading } = useQuery({
    queryKey: ["/api/clientes-externos"],
    refetchInterval: 30000,
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
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/unified"] });
      toast({
        title: "Sincronização concluída",
        description: "Dados da conta principal atualizados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar os dados.",
        variant: "destructive"
      });
    }
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
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/unified"] });
      toast({
        title: "Sincronização concluída",
        description: "Dados da conta Andrey atualizados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar os dados.",
        variant: "destructive"
      });
    }
  });

  // Consolidar todos os clientes
  const todosClientes = useMemo(() => {
    const clientes: Cliente[] = [];
    
    // Adicionar clientes unificados (Asaas)
    if (clientesUnificados?.clientes) {
      clientesUnificados.clientes.forEach((cliente: any) => {
        clientes.push({
          id: cliente.id,
          nome: cliente.nomeCompleto || cliente.nome,
          nomeCompleto: cliente.nomeCompleto,
          email: cliente.email,
          telefone: cliente.telefonePrincipal || cliente.telefone,
          cpf: cliente.numeroDocumento,
          planoNome: cliente.valorPlanoAtual ? `Plano R$ ${cliente.valorPlanoAtual}` : 'N/A',
          planoValor: cliente.valorPlanoAtual,
          formaPagamento: 'Asaas',
          statusAssinatura: cliente.statusAssinatura || 'Ativo',
          dataUltimoPagamento: cliente.dataUltimoPagamento,
          origem: cliente.origem || 'Asaas',
          asaasCustomerId: cliente.idAsaasPrincipal || cliente.idAsaasAndrey,
          cidade: cliente.cidade,
          estado: cliente.estado,
          createdAt: cliente.createdAt || new Date().toISOString()
        });
      });
    }
    
    // Adicionar clientes externos
    if (clientesExternos?.clientes) {
      clientesExternos.clientes.forEach((cliente: ClienteExterno) => {
        clientes.push({
          id: cliente.id + 10000, // Offset para evitar conflito de IDs
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpf,
          planoNome: cliente.planoNome,
          planoValor: cliente.planoValor,
          formaPagamento: cliente.formaPagamento,
          statusAssinatura: cliente.statusAssinatura || 'Ativo',
          dataInicioAssinatura: cliente.dataInicioAssinatura,
          dataVencimentoAssinatura: cliente.dataVencimentoAssinatura,
          origem: 'Externo',
          createdAt: cliente.createdAt,
          observacoes: cliente.observacoes
        });
      });
    }
    
    return clientes;
  }, [clientesUnificados, clientesExternos]);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    return todosClientes.filter((cliente: Cliente) => {
      const matchSearch = !searchTerm || 
        cliente.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.telefone?.includes(searchTerm) ||
        cliente.cpf?.includes(searchTerm);
      
      const matchStatus = filterStatus === "todos" || cliente.statusAssinatura === filterStatus;
      const matchOrigem = filterOrigem === "todas" || cliente.origem === filterOrigem;
      const matchTab = selectedTab === "todos" || 
        (selectedTab === "asaas" && cliente.origem !== "Externo") ||
        (selectedTab === "externos" && cliente.origem === "Externo");
      
      return matchSearch && matchStatus && matchOrigem && matchTab;
    });
  }, [todosClientes, searchTerm, filterStatus, filterOrigem, selectedTab]);

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Ativo</Badge>;
      case 'cancelado':
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'vencido':
      case 'expired':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">Vencido</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  const getFormaPagamentoBadge = (forma?: string) => {
    switch (forma?.toLowerCase()) {
      case 'credit_card':
      case 'cartão de crédito':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-300">Cartão</Badge>;
      case 'pix':
        return <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-300">PIX</Badge>;
      case 'debit':
      case 'cartão de débito':
        return <Badge variant="default" className="bg-indigo-100 text-indigo-800 border-indigo-300">Débito</Badge>;
      case 'cash':
      case 'dinheiro':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Dinheiro</Badge>;
      case 'asaas':
        return <Badge variant="default" className="bg-slate-100 text-slate-800 border-slate-300">Asaas</Badge>;
      default:
        return <Badge variant="outline">{forma || 'N/A'}</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatCurrency = (value?: string) => {
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  };

  const isLoading = clientesLoading || externosLoading || statsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors bg-primary/10 rounded-xl px-4 py-2 hover:bg-primary/20"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Gestão de Clientes
              </h1>
              <p className="text-muted-foreground">
                Visualize e gerencie todos os clientes do sistema
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => syncPrincipalMutation.mutate()}
                disabled={syncPrincipalMutation.isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncPrincipalMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Principal
              </Button>
              <Button
                onClick={() => syncAndreyMutation.mutate()}
                disabled={syncAndreyMutation.isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncAndreyMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Andrey
              </Button>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Clientes</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {estatisticas.moderna?.totalClientes || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Receita Total</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(estatisticas.moderna?.receitaTotal)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Asaas Principal</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {estatisticas.asaasPrincipal?.totalClientes || 0}
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Asaas Andrey</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {estatisticas.asaasAndrey?.totalClientes || 0}
                    </p>
                  </div>
                  <ExternalLink className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros e Busca */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email, telefone ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                    <SelectItem value="Vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas Origens</SelectItem>
                    <SelectItem value="Asaas">Asaas</SelectItem>
                    <SelectItem value="Externo">Externos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Categorias */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="todos">Todos ({todosClientes.length})</TabsTrigger>
            <TabsTrigger value="asaas">
              Asaas ({todosClientes.filter(c => c.origem !== "Externo").length})
            </TabsTrigger>
            <TabsTrigger value="externos">
              Externos ({todosClientes.filter(c => c.origem === "Externo").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Lista de Clientes ({clientesFiltrados.length})
                </CardTitle>
                <CardDescription>
                  {isLoading ? "Carregando clientes..." : "Gerencie todos os seus clientes em um só lugar"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : clientesFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Nenhum cliente encontrado</h3>
                    <p className="text-sm text-muted-foreground">
                      Ajuste os filtros ou sincronize os dados para ver mais clientes.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Última Atividade</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="w-[50px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientesFiltrados.map((cliente) => (
                          <TableRow key={`${cliente.origem}-${cliente.id}`} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                    {cliente.nome?.charAt(0)?.toUpperCase() || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{cliente.nome}</p>
                                  {cliente.cpf && (
                                    <p className="text-sm text-muted-foreground">{cliente.cpf}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div className="space-y-1">
                                {cliente.email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3 w-3" />
                                    {cliente.email}
                                  </div>
                                )}
                                {cliente.telefone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-3 w-3" />
                                    {cliente.telefone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.planoNome || 'N/A'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(cliente.planoValor)}
                                </p>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              {getFormaPagamentoBadge(cliente.formaPagamento)}
                            </TableCell>
                            
                            <TableCell>
                              {getStatusBadge(cliente.statusAssinatura)}
                            </TableCell>
                            
                            <TableCell>
                              <div className="text-sm">
                                {cliente.dataUltimoPagamento ? (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(cliente.dataUltimoPagamento)}
                                  </div>
                                ) : cliente.dataInicioAssinatura ? (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(cliente.dataInicioAssinatura)}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <Badge variant={cliente.origem === "Externo" ? "secondary" : "default"}>
                                {cliente.origem}
                              </Badge>
                            </TableCell>
                            
                            <TableCell>
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
                                    <FileText className="h-4 w-4 mr-2" />
                                    Histórico
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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