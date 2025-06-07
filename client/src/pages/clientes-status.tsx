import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  RefreshCw, 
  DollarSign,
  Phone,
  User,
  CheckCircle,
  TrendingUp
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoadingClientsState } from "@/components/error-illustrations";

interface ClienteAtivo {
  id: string;
  nomeCompleto: string;
  telefone?: string;
  email?: string;
  statusAssinatura: string;
}

interface FaturamentoMes {
  valorTotal: number;
  mes: string;
  totalClientes: number;
}

interface ApiResponseClientes {
  success: boolean;
  total: number;
  clientesAtivos: number;
  clientesInadimplentes: number;
  clientes: ClienteAtivo[];
}

interface ApiResponseFaturamento {
  success: boolean;
  totalClientes: number;
  valorTotal: number;
  mes: string;
}

export default function ClientesStatus() {
  const [busca, setBusca] = useState("");

  // Buscar clientes com status ativo
  const { data: dadosClientes, isLoading: loadingClientes, error: errorClientes, refetch: refetchClientes } = useQuery<ApiResponseClientes>({
    queryKey: ["/api/clientes/unificados-status"],
    queryFn: async () => {
      const response = await fetch('/api/clientes/unificados-status');
      if (!response.ok) {
        throw new Error("Erro ao carregar status dos clientes");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Buscar faturamento do mês das assinaturas
  const { data: dadosFaturamento, isLoading: loadingFaturamento, error: errorFaturamento, refetch: refetchFaturamento } = useQuery<ApiResponseFaturamento>({
    queryKey: ["/api/clientes/pagamentos-mes"],
    queryFn: async () => {
      const response = await fetch('/api/clientes/pagamentos-mes');
      if (!response.ok) {
        throw new Error("Erro ao carregar faturamento do mês");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Filtrar apenas clientes ativos e aplicar busca
  const clientesAtivos = useMemo(() => {
    if (!dadosClientes?.clientes) return [];

    const ativos = dadosClientes.clientes.filter(cliente => 
      cliente.statusAssinatura === 'ATIVO'
    );

    if (!busca) return ativos;
    
    return ativos.filter((cliente) =>
      cliente.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.telefone?.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.email?.toLowerCase().includes(busca.toLowerCase())
    );
  }, [dadosClientes?.clientes, busca]);

  const formatarTelefone = (telefone?: string) => {
    if (!telefone) return "Não informado";
    
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
      return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numeros.length === 10) {
      return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const mesAtualFormatado = dadosFaturamento?.mes ? 
    format(new Date(dadosFaturamento.mes + '-01'), "MMM/yyyy", { locale: ptBR }) : 
    format(new Date(), "MMM/yyyy", { locale: ptBR });

  const isLoading = loadingClientes || loadingFaturamento;
  const error = errorClientes || errorFaturamento;

  if (isLoading) {
    return <LoadingClientsState />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar dados</h2>
          <p className="text-muted-foreground mb-4">Não foi possível carregar os dados dos clientes.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => refetchClientes()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar Clientes
            </Button>
            <Button onClick={() => refetchFaturamento()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar Faturamento
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes Ativos</h1>
          <p className="text-muted-foreground">
            Assinantes com status ativo no sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { refetchClientes(); refetchFaturamento(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Card de Faturamento */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-green-800">
            Faturamento de Assinaturas ({mesAtualFormatado})
          </CardTitle>
          <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-700 mb-1">
            {formatarMoeda(dadosFaturamento?.valorTotal || 0)}
          </div>
          <p className="text-sm text-green-600">
            <DollarSign className="inline h-3 w-3 mr-1" />
            {dadosFaturamento?.totalClientes || 0} clientes pagantes no mês
          </p>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Clientes Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Clientes com Assinatura Ativa ({clientesAtivos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientesAtivos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente ativo encontrado</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clientesAtivos.map((cliente) => (
                <div 
                  key={cliente.id} 
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-green-300 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                        {cliente.nomeCompleto}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Phone className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          {formatarTelefone(cliente.telefone)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}