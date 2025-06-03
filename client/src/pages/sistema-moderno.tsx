import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, Database, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function SistemaModernoPage() {
  const [selectedTab, setSelectedTab] = useState("estatisticas");
  const queryClient = useQueryClient();

  // Buscar estatísticas consolidadas
  const { data: estatisticas, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/v2/estatisticas"],
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Buscar clientes da nova estrutura
  const { data: clientesData, isLoading: clientesLoading } = useQuery({
    queryKey: ["/api/v2/clientes"],
  });

  // Buscar validação de integridade
  const { data: integridade, isLoading: integridadeLoading } = useQuery({
    queryKey: ["/api/v2/clientes/validar-integridade"],
  });

  // Mutation para sincronização Asaas Principal
  const syncPrincipalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v2/sync/asaas-principal", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/estatisticas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/clientes"] });
    },
  });

  // Mutation para sincronização Asaas Andrey
  const syncAndreyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/v2/sync/asaas-andrey", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Erro na sincronização");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/estatisticas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/clientes"] });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistema Moderno de Clientes</h1>
          <p className="text-gray-600">Gestão avançada com integração Asaas</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncPrincipalMutation.mutate()}
            disabled={syncPrincipalMutation.isPending}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {syncPrincipalMutation.isPending ? "Sincronizando..." : "Sync Principal"}
          </Button>
          <Button 
            onClick={() => syncAndreyMutation.mutate()}
            disabled={syncAndreyMutation.isPending}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {syncAndreyMutation.isPending ? "Sincronizando..." : "Sync Andrey"}
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="integridade">Integridade</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="estatisticas" className="space-y-4">
          {statsLoading ? (
            <div className="text-center py-8">Carregando estatísticas...</div>
          ) : (
            <>
              {/* Cards de estatísticas consolidadas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {estatisticas?.consolidado?.totalClientes || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Todas as fontes consolidadas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(estatisticas?.consolidado?.receitaTotal || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Receita mensal ativa
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sistema Moderno</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {estatisticas?.moderna?.clientesAtivos || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clientes na nova estrutura
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Asaas APIs</CardTitle>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(estatisticas?.asaasPrincipal?.assinaturasAtivas || 0) + 
                       (estatisticas?.asaasAndrey?.assinaturasAtivas || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Principal + Andrey
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown detalhado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sistema Moderno</CardTitle>
                    <CardDescription>Nova estrutura de banco</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Clientes Ativos:</span>
                      <Badge variant="outline">{estatisticas?.moderna?.clientesAtivos || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Clientes Hoje:</span>
                      <Badge variant="outline">{estatisticas?.moderna?.clientesHoje || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita:</span>
                      <span className="font-medium">{formatCurrency(estatisticas?.moderna?.receitaAtiva || 0)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Asaas Principal</CardTitle>
                    <CardDescription>Conta principal do Asaas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Assinaturas Ativas:</span>
                      <Badge variant="outline">{estatisticas?.asaasPrincipal?.assinaturasAtivas || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita:</span>
                      <span className="font-medium">{formatCurrency(estatisticas?.asaasPrincipal?.receitaAtiva || 0)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Asaas Andrey</CardTitle>
                    <CardDescription>Conta Andrey do Asaas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Assinaturas Ativas:</span>
                      <Badge variant="outline">{estatisticas?.asaasAndrey?.assinaturasAtivas || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita:</span>
                      <span className="font-medium">{formatCurrency(estatisticas?.asaasAndrey?.receitaAtiva || 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          {clientesLoading ? (
            <div className="text-center py-8">Carregando clientes...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Clientes da Nova Estrutura</CardTitle>
                <CardDescription>
                  Total de {clientesData?.total || 0} clientes na estrutura moderna
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientesData?.clientes?.length > 0 ? (
                  <div className="space-y-4">
                    {clientesData.clientes.map((cliente: any) => (
                      <div key={cliente.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{cliente.nomeCompleto}</h3>
                          <Badge 
                            variant={cliente.statusDescricao === 'Cliente Ativo' ? 'default' : 'secondary'}
                          >
                            {cliente.statusDescricao}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <strong>Email:</strong> {cliente.email}
                          </div>
                          <div>
                            <strong>Telefone:</strong> {cliente.telefonePrincipal || 'N/A'}
                          </div>
                          <div>
                            <strong>Plano:</strong> {formatCurrency(parseFloat(cliente.valorPlanoAtual || '0'))}
                          </div>
                          <div>
                            <strong>Origem:</strong> {cliente.origemNome}
                          </div>
                        </div>
                        {cliente.dataVencimentoPlano && (
                          <div className="text-sm text-gray-600">
                            <strong>Vencimento:</strong> {formatDate(cliente.dataVencimentoPlano)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum cliente encontrado na nova estrutura
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="integridade" className="space-y-4">
          {integridadeLoading ? (
            <div className="text-center py-8">Validando integridade...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Validação de Integridade</CardTitle>
                <CardDescription>
                  Verificação automática da qualidade dos dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integridade?.problemas?.length > 0 ? (
                  <div className="space-y-3">
                    {integridade.problemas.map((problema: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border rounded">
                        {problema.quantidade > 0 ? (
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        <div className="flex-1">
                          <span className="font-medium">{problema.problema}</span>
                        </div>
                        <Badge variant={problema.quantidade > 0 ? "destructive" : "outline"}>
                          {problema.quantidade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum problema de integridade encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Sincronização</CardTitle>
              <CardDescription>
                Histórico de sincronizações com as APIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Funcionalidade de logs em desenvolvimento
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}