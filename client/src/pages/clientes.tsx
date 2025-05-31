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
import { UserCheck, Calendar, DollarSign, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface AsaasSubscription {
  id: string;
  subscriptionId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpfCnpj?: string;
  status: 'ACTIVE' | 'OVERDUE';
  value: number;
  cycle: string;
  billingType: string;
  nextDueDate: string;
  daysRemaining: number;
  planName: string;
  createdAt: string;
}

interface ClientesStats {
  totalActiveClients: number;
  totalMonthlyRevenue: number;
  newClientsThisMonth: number;
  overdueClients: number;
}

export default function Clientes() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/asaas/stats'],
    refetchInterval: 300000, // Atualiza a cada 5 minutos
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading, refetch } = useQuery<AsaasSubscription[]>({
    queryKey: ['/api/asaas/clientes'],
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
      ACTIVE: { label: "Ativo", variant: "default" as const },
      OVERDUE: { label: "Inadimplente", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.ACTIVE;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBillingTypeLabel = (billingType: string) => {
    const types = {
      BOLETO: "Boleto",
      CREDIT_CARD: "Cartão de Crédito",
      DEBIT_CARD: "Cartão de Débito",
      PIX: "PIX",
      BANK_SLIP: "Boleto Bancário"
    };
    return types[billingType as keyof typeof types] || billingType;
  };

  const getCycleLabel = (cycle: string) => {
    const cycles = {
      MONTHLY: "Mensal",
      WEEKLY: "Semanal",
      BIWEEKLY: "Quinzenal",
      QUARTERLY: "Trimestral",
      SEMIANNUALLY: "Semestral",
      YEARLY: "Anual"
    };
    return cycles[cycle as keyof typeof cycles] || cycle;
  };

  const getDaysRemainingColor = (days: number, status: string) => {
    if (status === 'OVERDUE') return "text-destructive font-semibold";
    if (status === 'EXPIRED') return "text-muted-foreground";
    if (days <= 3) return "text-destructive font-semibold";
    if (days <= 7) return "text-orange-500 font-medium";
    return "text-muted-foreground";
  };

  const formatDaysRemaining = (days: number, status: string) => {
    if (status === 'OVERDUE') {
      const daysOverdue = Math.abs(days);
      return `${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} em atraso`;
    }
    if (status === 'EXPIRED') return 'Expirado';
    if (days <= 0) return 'Vence hoje';
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  };

  if (statsLoading || subscriptionsLoading) {
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
          <h2 className="text-2xl font-bold text-foreground">Clientes Asaas</h2>
          <p className="text-muted-foreground">Clientes com assinaturas ativas sincronizados do Asaas</p>
        </div>
        
        <Button onClick={handleRefresh} className="rounded-xl">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar
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
            <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
            <UserCheck className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.overdueClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Pagamentos em atraso
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
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden md:table-cell">Forma de pagamento</TableHead>
                  <TableHead className="text-center">Data de vencimento</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
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
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(subscription.value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscription.planName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getBillingTypeLabel(subscription.billingType)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {new Date(subscription.nextDueDate).toLocaleDateString('pt-BR')}
                          {subscription.daysRemaining <= 3 && subscription.status === 'ACTIVE' && (
                            <span className="text-orange-500">⚠</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            💰
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            ℹ️
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            📧
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            📋
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            💳
                          </Button>
                        </div>
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