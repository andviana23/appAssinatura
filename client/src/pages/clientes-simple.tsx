import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserCheck, RefreshCw, Users, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

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
}

interface ClientesStats {
  totalActiveClients: number;
  totalSubscriptionRevenue: number;
  totalExpiringSubscriptions: number;
}

export default function Clientes() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<ClientesStats>({
    queryKey: ['/api/clientes-unified/stats'],
    refetchInterval: 300000,
  });

  const { data: clientes = [], isLoading: clientesLoading, refetch } = useQuery<ClienteUnificado[]>({
    queryKey: ['/api/clientes-unified'],
    refetchInterval: 300000,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600 mt-1">
              Gerencie clientes e assinaturas do sistema
            </p>
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

        {/* Lista de Clientes */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Lista de Clientes ({clientes.length})
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
                clientes.map((cliente) => (
                  <div key={cliente.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{cliente.nome}</h3>
                        <p className="text-sm text-gray-600">{cliente.email}</p>
                        {cliente.telefone && (
                          <p className="text-sm text-gray-500">{cliente.telefone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge 
                          className={
                            cliente.statusAssinatura === 'ATIVO' 
                              ? "bg-green-100 text-green-700 border-green-200" 
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }
                        >
                          {cliente.statusAssinatura || 'INATIVO'}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">{cliente.origem}</p>
                        <p className="text-sm font-medium text-[#365e78]">
                          {cliente.planoValor ? formatCurrency(parseFloat(cliente.planoValor)) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Plano:</strong> {cliente.planoNome || 'N/A'} | 
                      <strong> Pagamento:</strong> {cliente.formaPagamento || 'N/A'}
                    </div>
                  </div>
                ))
              )}
              
              {clientes.length === 0 && !clientesLoading && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum cliente encontrado
                  </h3>
                  <p className="text-gray-500">
                    Os clientes aparecerão aqui quando forem cadastrados
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}