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
      return `${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} vencido`;
    }
    if (days === 0) return 'Vence hoje';
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
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
          <p className="text-muted-foreground">Todos os clientes com assinaturas ativas (Asaas + Pagamentos Externos)</p>
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

      {/* Recorrentes (Assinaturas) - Layout igual ao Asaas */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recorrentes (Assinaturas)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assinaturas ativas e inadimplentes do mês atual
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Cliente</TableHead>
                  <TableHead>Nome do Link de Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead className="text-center">Dias Restantes</TableHead>
                  <TableHead className="text-center">Próximo Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma assinatura encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptions.map((subscription) => (
                    <TableRow key={subscription.subscriptionId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            subscription.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-blue-600 hover:underline cursor-pointer">
                            {subscription.customerName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscription.planName}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subscription.status)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(subscription.value)}
                      </TableCell>
                      <TableCell className={`text-center ${getDaysRemainingColor(subscription.daysRemaining, subscription.status)}`}>
                        {formatDaysRemaining(subscription.daysRemaining, subscription.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {new Date(subscription.nextDueDate).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}