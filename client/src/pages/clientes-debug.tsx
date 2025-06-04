import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DollarSign, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function ClientesDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  // Buscar estatísticas do dashboard
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["/api/clientes-unified/stats"],
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  // Buscar clientes locais
  const { data: clientesLocais, isLoading: locaisLoading } = useQuery({
    queryKey: ["/api/clientes"],
  });

  // Buscar clientes da conta Principal
  const { data: clientesPrincipal, isLoading: principalLoading } = useQuery({
    queryKey: ["/api/clientes-asaas-principal"],
  });

  // Buscar clientes da conta Andrey
  const { data: clientesAndrey, isLoading: andreyLoading } = useQuery({
    queryKey: ["/api/clientes-asaas-andrey"],
  });

  // Buscar clientes unificados
  const { data: clientesUnificados, isLoading: unificadosLoading } = useQuery({
    queryKey: ["/api/clientes-unified"],
  });

  const testAsaasConnections = async () => {
    console.log("Testando conexões com Asaas...");
    const results = [];

    try {
      // Testar conta Principal
      const principalResponse = await fetch("/api/clientes-asaas-principal");
      results.push({
        conta: "Principal",
        status: principalResponse.ok ? "✅ Conectado" : "❌ Erro",
        data: principalResponse.ok ? await principalResponse.json() : null
      });
    } catch (error) {
      results.push({
        conta: "Principal", 
        status: "❌ Erro de conexão",
        error: error
      });
    }

    try {
      // Testar conta Andrey
      const andreyResponse = await fetch("/api/clientes-asaas-andrey");
      results.push({
        conta: "Andrey",
        status: andreyResponse.ok ? "✅ Conectado" : "❌ Erro", 
        data: andreyResponse.ok ? await andreyResponse.json() : null
      });
    } catch (error) {
      results.push({
        conta: "Andrey",
        status: "❌ Erro de conexão", 
        error: error
      });
    }

    setDebugInfo(results);
  };

  const limparDadosAntigos = async () => {
    try {
      const response = await fetch("/api/admin/limpar-dados", {
        method: "POST"
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Limpeza realizada: ${result.clientesInativados} clientes inativados, ${result.clientesHoje} clientes mantidos`);
        // Recarregar dados
        window.location.reload();
      } else {
        alert("Erro ao limpar dados");
      }
    } catch (error) {
      alert("Erro ao executar limpeza");
    }
  };

  useEffect(() => {
    testAsaasConnections();
  }, []);

  if (statsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Carregando estatísticas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Diagnóstico de Clientes</h1>
        <div className="flex gap-2">
          <Button onClick={limparDadosAntigos} variant="destructive">
            Limpar Dados Antigos
          </Button>
          <Button onClick={testAsaasConnections} variant="outline">
            Testar Conexões
          </Button>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Todas as fontes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.clientesAtivos || 0}</div>
            <p className="text-xs text-muted-foreground">Com pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita de Assinaturas</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats?.valorTotalAssinaturas?.toFixed(2) || "0,00"}
            </div>
            <p className="text-xs text-muted-foreground">Receita confirmada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status API</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {statsError ? (
                <Badge variant="destructive">Erro na API</Badge>
              ) : (
                <Badge variant="default">Funcionando</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Origem */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Origem</CardTitle>
          <CardDescription>Distribuição de clientes por fonte de dados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.origem?.map((origem: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">{origem.origem}</h4>
                  <p className="text-sm text-muted-foreground">
                    {origem.origem === 'LOCAL_EXTERNO' && 'Clientes externos (PIX/Cartão)'}
                    {origem.origem === 'ASAAS_PRINCIPAL' && 'Conta principal Asaas'}
                    {origem.origem === 'ASAAS_AND' && 'Conta Andrey "Trato de Barbados"'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{origem.total}</div>
                  <p className="text-xs text-muted-foreground">clientes</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Detalhado */}
      {stats?.breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown Financeiro</CardTitle>
            <CardDescription>Receita detalhada por fonte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-blue-600">Local/Externos</h4>
                <p className="text-2xl font-bold">R$ {stats.breakdown.local?.receita?.toFixed(2) || "0,00"}</p>
                <p className="text-sm text-muted-foreground">{stats.breakdown.local?.total || 0} clientes</p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-green-600">Principal Asaas</h4>
                <p className="text-2xl font-bold">R$ {stats.breakdown.principal?.receita?.toFixed(2) || "0,00"}</p>
                <p className="text-sm text-muted-foreground">{stats.breakdown.principal?.total || 0} assinaturas</p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-purple-600">Andrey Asaas</h4>
                <p className="text-2xl font-bold">R$ {stats.breakdown.andrey?.receita?.toFixed(2) || "0,00"}</p>
                <p className="text-sm text-muted-foreground">{stats.breakdown.andrey?.total || 0} assinaturas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Testes de Conexão */}
      <Card>
        <CardHeader>
          <CardTitle>Testes de Conexão</CardTitle>
          <CardDescription>Status das conexões com as APIs do Asaas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {debugInfo.map((info, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">Conta {info.conta}</h4>
                  <p className="text-sm text-muted-foreground">
                    {info.data?.total ? `${info.data.total} registros encontrados` : 'Sem dados'}
                  </p>
                </div>
                <Badge variant={info.status.includes('✅') ? 'default' : 'destructive'}>
                  {info.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Abas com Dados Detalhados */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="locais">Locais</TabsTrigger>
          <TabsTrigger value="principal">Principal</TabsTrigger>
          <TabsTrigger value="andrey">Andrey</TabsTrigger>
          <TabsTrigger value="unificados">Unificados</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Raw JSON - Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                {JSON.stringify(stats, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locais" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes Locais ({clientesLocais?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {locaisLoading ? (
                <p>Carregando...</p>
              ) : (
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                  {JSON.stringify(clientesLocais, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="principal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes Principal ({clientesPrincipal?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {principalLoading ? (
                <p>Carregando...</p>
              ) : (
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                  {JSON.stringify(clientesPrincipal, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="andrey" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes Andrey ({clientesAndrey?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {andreyLoading ? (
                <p>Carregando...</p>
              ) : (
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                  {JSON.stringify(clientesAndrey, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unificados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes Unificados ({clientesUnificados?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {unificadosLoading ? (
                <p>Carregando...</p>
              ) : (
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
                  {JSON.stringify(clientesUnificados, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alertas de Erro */}
      {statsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar estatísticas: {(statsError as Error).message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}