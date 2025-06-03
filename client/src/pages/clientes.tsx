import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  Search, 
  RefreshCw, 
  DollarSign,
  Trash2,
  X,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoadingClientsState, GenericErrorState } from "@/components/error-illustrations";

interface ClienteAssinatura {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  valorPago: number;
  nomePlano: string;
  statusPagamento: 'CONFIRMED' | 'PENDING' | 'OVERDUE';
  dataVencimento: string;
  assinaturaId: string;
  conta: 'ASAAS_TRATO' | 'ASAAS_AND';
}

interface FaturamentoMensal {
  totalFaturado: number;
  quantidadeAssinaturas: number;
  mes: string;
}

interface ApiResponse {
  success: boolean;
  clientes: ClienteAssinatura[];
  faturamento: FaturamentoMensal;
}

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar dados dos clientes com assinaturas filtrados por mês
  const { data: dadosClientes, isLoading, error, refetch } = useQuery<ApiResponse>({
    queryKey: ["/api/clientes/assinaturas", mesSelecionado],
    queryFn: async () => {
      const response = await fetch(`/api/clientes/assinaturas?mes=${mesSelecionado}`);
      if (!response.ok) {
        throw new Error("Erro ao carregar dados dos clientes");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Mutation para cancelar assinatura
  const cancelarAssinaturaMutation = useMutation({
    mutationFn: async ({ clienteId, assinaturaId }: { clienteId: string; assinaturaId: string }) => {
      const response = await fetch(`/api/assinaturas/${assinaturaId}/cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clienteId }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao cancelar assinatura');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Assinatura cancelada",
        description: "A assinatura foi cancelada com sucesso no Asaas",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/assinaturas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar cliente
  const deletarClienteMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const response = await fetch(`/api/clientes/${clienteId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao deletar cliente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente removido",
        description: "O cliente foi removido do sistema",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes/assinaturas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelarAssinatura = (cliente: ClienteAssinatura) => {
    if (confirm(`Deseja cancelar a assinatura de ${cliente.nome}? Esta ação não pode ser desfeita.`)) {
      cancelarAssinaturaMutation.mutate({
        clienteId: cliente.id,
        assinaturaId: cliente.assinaturaId
      });
    }
  };

  const handleDeletarCliente = (cliente: ClienteAssinatura) => {
    if (confirm(`Deseja remover ${cliente.nome} do sistema? Esta ação não pode ser desfeita.`)) {
      deletarClienteMutation.mutate(cliente.id);
    }
  };

  // Filtrar clientes pela busca
  const clientesFiltrados = dadosClientes?.clientes?.filter(cliente => 
    cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
    cliente.nomePlano.toLowerCase().includes(busca.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(busca.toLowerCase())
  ) || [];

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" />Vencido</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes Assinantes</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie assinaturas e faturamento dos clientes
            </p>
          </div>
        </div>
        <LoadingClientsState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes Assinantes</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie assinaturas e faturamento dos clientes
            </p>
          </div>
        </div>
        <GenericErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes Assinantes</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie assinaturas e faturamento dos clientes
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="mes-filtro" className="text-sm font-medium">Mês:</label>
            <Input
              id="mes-filtro"
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="w-40"
            />
          </div>
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

      {/* Cards de Status dos Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dadosClientes?.clientes?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quantidade total de clientes cadastrados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dadosClientes?.clientes?.filter(c => c.statusPagamento === 'CONFIRMED').length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Assinaturas ativas no mês atual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Inadimplentes</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dadosClientes?.clientes?.filter(c => c.statusPagamento === 'OVERDUE').length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cobranças em atraso no mês vigente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, plano ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {busca ? "Tente ajustar os termos de busca" : "Não há clientes com assinaturas ativas"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor Pago</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{cliente.nome}</div>
                        {cliente.email && (
                          <div className="text-sm text-muted-foreground">{cliente.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cliente.nomePlano}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatarMoeda(cliente.valorPago)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(cliente.statusPagamento)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(cliente.dataVencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cliente.conta === 'ASAAS_TRATO' ? 'default' : 'secondary'}>
                        {cliente.conta === 'ASAAS_TRATO' ? 'Trato' : 'Andrey'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelarAssinatura(cliente)}
                          disabled={cancelarAssinaturaMutation.isPending}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletarCliente(cliente)}
                          disabled={deletarClienteMutation.isPending}
                          className="text-red-600 hover:text-red-700"
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

      {/* Informações do Sistema */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Informações do Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Faturamento:</strong> Soma dos pagamentos confirmados do mês atual</p>
            <p>• <strong>Cancelar:</strong> Cancela a assinatura imediatamente no Asaas</p>
            <p>• <strong>Deletar:</strong> Remove o cliente do sistema local</p>
            <p>• <strong>Atualização:</strong> Dados sincronizados automaticamente a cada 30 segundos</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}