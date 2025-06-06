import { useQuery } from "@tanstack/react-query";
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
  Calendar,
  CreditCard,
  UserPlus
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { LoadingClientsState, GenericErrorState } from "@/components/error-illustrations";

interface ClientePagante {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  valorPago: number;
  dataPagamento: string;
  descricao: string;
  conta: 'ASAAS_TRATO' | 'ASAAS_AND';
}

interface ApiResponse {
  success: boolean;
  totalClientes: number;
  valorTotal: number;
  mes: string;
  clientes: ClientePagante[];
}

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [, navigate] = useLocation();

  // Buscar clientes pagantes do mês vigente
  const { data: dadosPagamentos, isLoading, error, refetch } = useQuery<ApiResponse>({
    queryKey: ["/api/clientes/pagamentos-mes"],
    queryFn: async () => {
      const response = await fetch('/api/clientes/pagamentos-mes');
      if (!response.ok) {
        throw new Error("Erro ao carregar pagamentos do mês");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Filtrar clientes por busca
  const clientesFiltrados = dadosPagamentos?.clientes.filter((cliente: ClientePagante) => {
    if (!busca) return true;
    
    return (
      cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.email?.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.descricao.toLowerCase().includes(busca.toLowerCase())
    );
  }) || [];

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    try {
      const data = new Date(dataStr);
      return format(data, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  const getContaBadgeColor = (conta: string) => {
    return conta === 'ASAAS_TRATO' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  if (isLoading) {
    return <LoadingClientsState />;
  }

  if (error) {
    return (
      <GenericErrorState
        title="Erro ao carregar pagamentos"
        description="Não foi possível carregar os dados dos pagamentos do mês."
        actionLabel="Tentar novamente"
        onAction={() => refetch()}
      />
    );
  }

  const mesAtualFormatado = dadosPagamentos?.mes ? 
    format(new Date(dadosPagamentos.mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR }) : 
    format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes Pagantes</h1>
          <p className="text-muted-foreground">
            Pagamentos realizados em {mesAtualFormatado}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate("/clientes/cadastro")} 
            variant="default" 
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar Cliente
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dadosPagamentos?.totalClientes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clientes que pagaram no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatarMoeda(dadosPagamentos?.valorTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita do mês vigente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mês de Referência</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dadosPagamentos?.mes || new Date().toISOString().slice(0, 7)}</div>
            <p className="text-xs text-muted-foreground">
              Período analisado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou descrição..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Clientes Pagantes ({clientesFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Conta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente) => (
                    <TableRow key={`${cliente.id}-${cliente.conta}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{cliente.nome}</div>
                          <div className="text-sm text-muted-foreground">ID: {cliente.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {cliente.email && (
                            <div className="text-sm">{cliente.email}</div>
                          )}
                          {cliente.telefone && (
                            <div className="text-sm text-muted-foreground">{cliente.telefone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-green-600">
                          {formatarMoeda(cliente.valorPago)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatarData(cliente.dataPagamento)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-xs truncate" title={cliente.descricao}>
                          {cliente.descricao}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={getContaBadgeColor(cliente.conta)}
                        >
                          {cliente.conta === 'ASAAS_TRATO' ? 'Trato' : 'Andrey'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}