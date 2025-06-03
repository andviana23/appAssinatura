import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  RefreshCw, 
  Phone, 
  Mail, 
  Calendar,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Building2,
  Trash2,
  Ban
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ClienteUnificado {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  dateCreated: string;
  conta: 'ASAAS_TRATO' | 'ASAAS_AND';
  status: 'ativo' | 'inativo' | 'aguardando_pagamento';
  notificationDisabled: boolean;
  deleted: boolean;
}

interface ClientesPorStatus {
  ativos: {
    total: number;
    clientes: ClienteUnificado[];
  };
  inativos: {
    total: number;
    clientes: ClienteUnificado[];
  };
  aguardandoPagamento: {
    total: number;
    clientes: ClienteUnificado[];
  };
  total: number;
}

export default function ClientesStatusPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar clientes unificados por status
  const { data: clientesPorStatus, isLoading, refetch } = useQuery<ClientesPorStatus>({
    queryKey: ["/api/clientes/unificados-status"],
    refetchInterval: 30000,
  });

  // Mutation para cancelar assinatura
  const cancelarAssinatura = useMutation({
    mutationFn: async (cliente: any) => {
      if (cliente.conta === 'PAGAMENTO_EXTERNO') {
        // Para pagamento externo, marcar como cancelado
        const response = await apiRequest(`/api/clientes-externos/${cliente.id}/cancelar`, "POST");
        return response.json();
      } else {
        // Para Asaas, cancelar via API
        const response = await apiRequest(`/api/assinaturas/${cliente.id}/cancelar`, "POST", {
          clienteId: cliente.id
        });
        return response.json();
      }
    },
    onSuccess: (data, cliente) => {
      toast({
        title: "Assinatura cancelada",
        description: cliente.conta === 'PAGAMENTO_EXTERNO' 
          ? "Cliente marcado como cancelado. Será removido automaticamente ao fim do período."
          : "Assinatura cancelada na plataforma Asaas.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/unificados-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar assinatura",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar cliente
  const deletarCliente = useMutation({
    mutationFn: async (cliente: any) => {
      if (cliente.conta === 'PAGAMENTO_EXTERNO') {
        const response = await apiRequest(`/api/clientes-externos/${cliente.id}/deletar`, "DELETE");
        return response.json();
      } else {
        const response = await apiRequest(`/api/clientes-asaas/${cliente.id}/deletar`, "DELETE");
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Cliente deletado",
        description: "Cliente removido do sistema com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/unificados-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const getContaBadge = (conta: string) => {
    switch (conta) {
      case 'ASAAS_TRATO':
        return <Badge variant="default" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Trato</Badge>;
      case 'ASAAS_AND':
        return <Badge variant="default" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">Andrey</Badge>;
      default:
        return <Badge variant="outline">{conta}</Badge>;
    }
  };

  const ClienteTable = ({ clientes, titulo, icon, cor }: { 
    clientes: ClienteUnificado[], 
    titulo: string, 
    icon: React.ReactNode, 
    cor: string 
  }) => (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle className="flex items-center gap-2">
          {icon}
          {titulo} ({clientes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {clientes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhum cliente encontrado nesta categoria
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={`${cliente.conta}-${cliente.id}`}>
                  <TableCell className="font-medium">{cliente.name}</TableCell>
                  <TableCell>
                    {cliente.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {cliente.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {cliente.phone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{getContaBadge(cliente.conta)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(cliente.dateCreated)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelarAssinatura.mutate(cliente)}
                        disabled={cancelarAssinatura.isPending}
                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 border-orange-300 hover:border-orange-400 dark:border-orange-600 dark:hover:border-orange-500"
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletarCliente.mutate(cliente)}
                        disabled={deletarCliente.isPending}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-300 hover:border-red-400 dark:border-red-600 dark:hover:border-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Deletar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
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
              <h1 className="text-3xl font-bold text-foreground">
                Clientes por Status
              </h1>
              <p className="text-muted-foreground">
                Visualização unificada das duas contas ASAAS organizadas por status
              </p>
            </div>
            
            <Button
              onClick={() => refetch()}
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Dados
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        {clientesPorStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border bg-card shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total de Clientes</p>
                    <p className="text-2xl font-bold text-card-foreground">
                      {clientesPorStatus.total}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantidade total cadastrados no sistema
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Clientes Ativos</p>
                    <p className="text-2xl font-bold text-card-foreground">
                      {clientesPorStatus.ativos.total}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assinaturas ativas no mês atual
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Clientes Inadimplentes</p>
                    <p className="text-2xl font-bold text-card-foreground">
                      {clientesPorStatus.inativos.total}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cobranças em atraso no mês vigente
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Abas de Status */}
        {clientesPorStatus && (
          <Tabs defaultValue="ativos" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ativos" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ativos ({clientesPorStatus.ativos.total})
              </TabsTrigger>
              <TabsTrigger value="inadimplentes" className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Inadimplentes ({clientesPorStatus.inativos.total})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativos">
              <ClienteTable 
                clientes={clientesPorStatus.ativos.clientes}
                titulo="Clientes Ativos"
                icon={<CheckCircle className="h-5 w-5" />}
                cor="bg-gradient-to-r from-green-600 to-green-700"
              />
            </TabsContent>

            <TabsContent value="inadimplentes">
              <ClienteTable 
                clientes={clientesPorStatus.inativos.clientes}
                titulo="Clientes Inadimplentes"
                icon={<XCircle className="h-5 w-5" />}
                cor="bg-gradient-to-r from-red-600 to-red-700"
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}