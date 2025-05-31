import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UserCheck, Calendar, DollarSign, RefreshCw, ExternalLink, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  totalMonthlyRevenue: number;
  newClientsThisMonth: number;
  overdueClients: number;
  totalExternalClients: number;
  totalAsaasClients: number;
}

export default function Clientes() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/clientes/unified-stats'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  const { data: clientes = [], isLoading: clientesLoading, refetch } = useQuery<ClienteUnificado[]>({
    queryKey: ['/api/clientes/unified'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Dados atualizados",
        description: "Informações dos clientes foram sincronizadas com o Asaas",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível sincronizar com o Asaas",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ATIVO: { label: "Ativo", variant: "default" as const },
      INATIVO: { label: "Inativo", variant: "secondary" as const },
      VENCIDO: { label: "Vencido", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INATIVO;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const getDaysRemaining = (dataValidade: string) => {
    const hoje = new Date();
    const validade = new Date(dataValidade);
    const diffTime = validade.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysRemainingColor = (days: number) => {
    if (days < 0) return "text-destructive font-semibold";
    if (days <= 3) return "text-destructive font-semibold";
    if (days <= 7) return "text-orange-500 font-medium";
    return "text-muted-foreground";
  };

  const formatDaysRemaining = (days: number) => {
    if (days < 0) {
      const daysOverdue = Math.abs(days);
      return `${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} em atraso`;
    }
    if (days === 0) return 'Vence hoje';
    return `${days} ${days === 1 ? 'dia' : 'dias'} restantes`;
  };

  if (statsLoading || clientesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Clientes Ativos</h2>
          <p className="text-muted-foreground">Clientes com cobranças confirmadas no Asaas (mês atual) + Pagamentos externos válidos</p>
        </div>
        
        <Button onClick={handleRefresh} className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar (5min automático)
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.totalActiveClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Assinaturas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{formatCurrency(stats?.totalMonthlyRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Soma das assinaturas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Este Mês</CardTitle>
            <Calendar className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.newClientsThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ativações em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Asaas</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.totalAsaasClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Pagamentos via Asaas
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Externos</CardTitle>
            <ExternalLink className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.totalExternalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Pagamentos externos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Todos os Clientes Ativos (Asaas + Externos) */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Todos os Clientes Ativos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cobranças confirmadas no Asaas (mês atual) + Pagamentos externos válidos (atualização automática a cada 5 minutos)
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead>Data do Pagamento</TableHead>
                  <TableHead>Próximo Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Dias Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente ativo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => {
                    const daysRemaining = getDaysRemaining(cliente.dataValidade);
                    return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getOrigemIcon(cliente.origem)}
                            <div>
                              <div className="font-medium">{cliente.nome}</div>
                              {cliente.cpf && (
                                <div className="text-xs text-muted-foreground">{cliente.cpf}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            <div>{cliente.email}</div>
                            {cliente.telefone && (
                              <div className="text-xs text-muted-foreground">{cliente.telefone}</div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-muted-foreground">
                          {cliente.planoNome}
                        </TableCell>
                        
                        <TableCell className="font-semibold">
                          {formatCurrency(cliente.planoValor)}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {getOrigemLabel(cliente.origem, cliente.formaPagamento)}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-sm">
                          {formatDate(cliente.dataInicio)}
                        </TableCell>
                        
                        <TableCell className="text-sm">
                          {formatDate(cliente.dataValidade)}
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(cliente.status)}
                        </TableCell>
                        
                        <TableCell className={`text-center text-sm ${getDaysRemainingColor(daysRemaining)}`}>
                          {formatDaysRemaining(daysRemaining)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}