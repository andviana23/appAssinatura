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

interface AsaasClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  subscriptionStatus: 'ACTIVE' | 'INACTIVE' | 'OVERDUE' | 'EXPIRED';
  monthlyValue: number;
  daysRemaining: number;
  nextDueDate: string;
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

  const { data: clientes = [], isLoading: clientesLoading, refetch } = useQuery<AsaasClient[]>({
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
      EXPIRED: { label: "Expirado", variant: "secondary" as const },
      INACTIVE: { label: "Inativo", variant: "outline" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INACTIVE;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

      {/* Clientes Table */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Dias Restantes</TableHead>
                  <TableHead className="hidden xl:table-cell">Próximo Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{cliente.name}</div>
                          <div className="text-sm text-muted-foreground md:hidden">{cliente.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{cliente.email}</TableCell>
                      <TableCell className="hidden sm:table-cell">{cliente.phone || '-'}</TableCell>
                      <TableCell>{getStatusBadge(cliente.subscriptionStatus)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(cliente.monthlyValue)}
                      </TableCell>
                      <TableCell className={`text-center hidden lg:table-cell ${getDaysRemainingColor(cliente.daysRemaining, cliente.subscriptionStatus)}`}>
                        {formatDaysRemaining(cliente.daysRemaining, cliente.subscriptionStatus)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {new Date(cliente.nextDueDate).toLocaleDateString('pt-BR')}
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