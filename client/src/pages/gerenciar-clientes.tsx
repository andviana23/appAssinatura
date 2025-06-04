import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Search, 
  RefreshCw, 
  CreditCard,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';

interface Cliente {
  id: number;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  statusAssinatura: string;
  proximoVencimento?: string;
  valorAssinatura?: number;
  planoId?: string;
  origem?: string;
}

interface Plano {
  id: number;
  nome: string;
  preco: number;
  descricao: string;
}

export function GerenciarClientes() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [planoSelecionado, setPlanoSelecionado] = useState('');
  const [cpfCobranca, setCpfCobranca] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todos os clientes
  const { data: clientes = [], isLoading: carregandoClientes, refetch } = useQuery<Cliente[]>({
    queryKey: ['/api/clientes/todos'],
    queryFn: async () => {
      const response = await fetch('/api/clientes/todos');
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    }
  });

  // Buscar planos disponíveis
  const { data: planos = [] } = useQuery<Plano[]>({
    queryKey: ['/api/planos'],
    queryFn: async () => {
      const response = await fetch('/api/planos');
      if (!response.ok) throw new Error('Erro ao carregar planos');
      return response.json();
    }
  });

  // Mutation para gerar cobrança
  const gerarCobrancaMutation = useMutation({
    mutationFn: async ({ clienteId, planoId, cpf }: { clienteId: number; planoId: string; cpf: string }) => {
      return apiRequest(`/api/clientes/${clienteId}/gerar-cobranca`, {
        method: 'POST',
        body: { planoId, cpf }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Cobrança gerada',
        description: 'Cobrança criada com sucesso no Asaas'
      });
      setDialogAberto(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao gerar cobrança',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    }
  });

  // Mutation para marcar como pago
  const marcarPagoMutation = useMutation({
    mutationFn: async (clienteId: number) => {
      return apiRequest(`/api/clientes/${clienteId}/marcar-pago`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Cliente ativado',
        description: 'Cliente marcado como ativo (+30 dias)'
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao marcar como pago',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    }
  });

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(cliente => {
    const matchBusca = cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       cliente.email?.toLowerCase().includes(busca.toLowerCase()) ||
                       cliente.telefone?.includes(busca) ||
                       cliente.cpf?.includes(busca);

    const matchStatus = filtroStatus === 'todos' || cliente.statusAssinatura === filtroStatus;

    return matchBusca && matchStatus;
  });

  const handleGerarCobranca = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setCpfCobranca(cliente.cpf || '');
    setPlanoSelecionado('');
    setDialogAberto(true);
  };

  const handleConfirmarCobranca = () => {
    if (!clienteSelecionado || !planoSelecionado || !cpfCobranca) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione o plano e informe o CPF',
        variant: 'destructive'
      });
      return;
    }

    gerarCobrancaMutation.mutate({
      clienteId: clienteSelecionado.id,
      planoId: planoSelecionado,
      cpf: cpfCobranca
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return <Badge variant="default" className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'inativo':
        return <Badge variant="destructive">Inativo</Badge>;
      case 'atrasado':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Atrasado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const resumo = {
    total: clientes.length,
    ativos: clientes.filter(c => c.statusAssinatura === 'ativo').length,
    inativos: clientes.filter(c => c.statusAssinatura === 'inativo').length,
    planilha: clientes.filter(c => c.origem === 'planilha').length
  };

  if (carregandoClientes) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Clientes</h1>
          <p className="text-muted-foreground">
            Todos os clientes cadastrados no sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/importar-clientes">
              <Upload className="h-4 w-4 mr-2" />
              Importar Clientes
            </Link>
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumo.ativos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{resumo.inativos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Da Planilha</CardTitle>
            <Upload className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{resumo.planilha}</div>
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
                  placeholder="Buscar por nome, email, telefone ou CPF..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="atrasado">Atrasados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes ({clientesFiltrados.length})
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Próximo Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>{cliente.email || '-'}</TableCell>
                      <TableCell>{cliente.telefone || '-'}</TableCell>
                      <TableCell>{getStatusBadge(cliente.statusAssinatura)}</TableCell>
                      <TableCell>
                        {cliente.proximoVencimento ? formatarData(cliente.proximoVencimento) : '-'}
                      </TableCell>
                      <TableCell>
                        {cliente.valorAssinatura ? formatarMoeda(cliente.valorAssinatura) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cliente.origem === 'planilha' ? 'Planilha' : 'Asaas'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {cliente.statusAssinatura === 'inativo' && (
                            <Button
                              size="sm"
                              onClick={() => handleGerarCobranca(cliente)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Gerar Cobrança
                            </Button>
                          )}
                          {cliente.statusAssinatura === 'inativo' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => marcarPagoMutation.mutate(cliente.id)}
                              disabled={marcarPagoMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Marcar Pago
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Gerar Cobrança */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cobrança - {clienteSelecionado?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plano">Selecionar Plano</Label>
              <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.id.toString()}>
                      {plano.nome} - {formatarMoeda(plano.preco)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cpf">CPF do Cliente (obrigatório)</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpfCobranca}
                onChange={(e) => setCpfCobranca(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                CPF será usado para criar a cobrança no Asaas
              </p>
            </div>

            <Alert>
              <AlertDescription>
                Uma cobrança será criada no Asaas usando o CPF fornecido e os dados já cadastrados do cliente.
                Se o pagamento for confirmado, o cliente será automaticamente ativado por mais 30 dias.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmarCobranca}
                disabled={gerarCobrancaMutation.isPending || !planoSelecionado || !cpfCobranca}
              >
                {gerarCobrancaMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Gerando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Gerar Cobrança
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}