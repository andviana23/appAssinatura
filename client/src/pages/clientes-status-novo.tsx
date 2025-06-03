import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  RefreshCw, 
  Phone, 
  Mail, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Filter
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
  total: number;
  mes: string;
}

export default function ClientesStatusNovo() {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: clientesPorStatus, isLoading, refetch } = useQuery<ClientesPorStatus>({
    queryKey: ["/api/clientes/unificados-status", mesSelecionado],
    refetchInterval: 30000,
  });

  // Gerar opções de meses (últimos 12 meses)
  const gerarOpcoesMeses = () => {
    const opcoes = [];
    const hoje = new Date();
    
    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const label = format(data, 'MMMM yyyy', { locale: ptBR });
      opcoes.push({ valor, label });
    }
    
    return opcoes;
  };

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
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {gerarOpcoesMeses().find(opcao => opcao.valor === mesSelecionado)?.label}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {gerarOpcoesMeses().map((opcao) => (
                <SelectItem key={opcao.valor} value={opcao.valor}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesPorStatus?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {gerarOpcoesMeses().find(opcao => opcao.valor === mesSelecionado)?.label}
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              Em dia ou dentro do prazo
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Atrasados</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {clientesPorStatus?.inativos.total || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamento vencido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com os clientes organizados */}
      <Tabs defaultValue="ativos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Ativos ({clientesPorStatus?.ativos.total || 0})
          </TabsTrigger>
          <TabsTrigger value="atrasados" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Atrasados ({clientesPorStatus?.inativos.total || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          <ClienteTable 
            clientes={clientesPorStatus?.ativos.clientes || []}
            titulo="Clientes Ativos (Em dia ou dentro do prazo)"
            icon={<CheckCircle className="h-5 w-5" />}
            cor="bg-green-600"
          />
        </TabsContent>

        <TabsContent value="atrasados">
          <ClienteTable 
            clientes={clientesPorStatus?.inativos.clientes || []}
            titulo="Clientes Atrasados (Pagamento vencido)"
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
            <p>• <strong>Clientes Ativos:</strong> Em dia ou cobrança ainda dentro do prazo</p>
            <p>• <strong>Clientes Atrasados:</strong> Pagamento vencido e não confirmado</p>
            <p>• Filtro por mês: {gerarOpcoesMeses().find(opcao => opcao.valor === mesSelecionado)?.label}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}