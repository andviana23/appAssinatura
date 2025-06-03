import { useQuery } from "@tanstack/react-query";
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
  CheckCircle,
  XCircle,
  Clock,
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function ClientesStatusNovo() {
  const { data: clientesPorStatus, isLoading, refetch } = useQuery<ClientesPorStatus>({
    queryKey: ["/api/clientes/unificados-status"],
    refetchInterval: 30000,
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
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Trato</Badge>;
      case 'ASAAS_AND':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Andrey</Badge>;
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
    <Card className="border-0 shadow-lg">
      <CardHeader className={`${cor} text-white`}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.name}</TableCell>
                  <TableCell>
                    {cliente.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{cliente.email}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{cliente.phone}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getContaBadge(cliente.conta)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(cliente.dateCreated)}</span>
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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes por Status</h1>
          <p className="text-muted-foreground mt-2">
            Visualização unificada dos clientes das contas ASAAS organizados por status
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesPorStatus?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {clientesPorStatus?.ativos.total || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Pagamento</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {clientesPorStatus?.aguardandoPagamento.total || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Inativos</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {clientesPorStatus?.inativos.total || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com os clientes organizados */}
      <Tabs defaultValue="ativos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Ativos ({clientesPorStatus?.ativos.total || 0})
          </TabsTrigger>
          <TabsTrigger value="aguardando" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aguardando ({clientesPorStatus?.aguardandoPagamento.total || 0})
          </TabsTrigger>
          <TabsTrigger value="inativos" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Inativos ({clientesPorStatus?.inativos.total || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          <ClienteTable 
            clientes={clientesPorStatus?.ativos.clientes || []}
            titulo="Clientes Ativos"
            icon={<CheckCircle className="h-5 w-5" />}
            cor="bg-green-600"
          />
        </TabsContent>

        <TabsContent value="aguardando">
          <ClienteTable 
            clientes={clientesPorStatus?.aguardandoPagamento.clientes || []}
            titulo="Clientes Aguardando Pagamento"
            icon={<Clock className="h-5 w-5" />}
            cor="bg-yellow-600"
          />
        </TabsContent>

        <TabsContent value="inativos">
          <ClienteTable 
            clientes={clientesPorStatus?.inativos.clientes || []}
            titulo="Clientes Inativos"
            icon={<XCircle className="h-5 w-5" />}
            cor="bg-red-600"
          />
        </TabsContent>
      </Tabs>

      {/* Informações Técnicas */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Dados sincronizados das contas: ASAAS_TRATO e ASAAS_AND</p>
            <p>• Atualização automática a cada 30 segundos</p>
            <p>• Status determinado pela análise de notificações e exclusões</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}