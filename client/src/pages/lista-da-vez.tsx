import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scissors, User, Trophy, Clock, Plus, Calendar, Check } from "lucide-react";
import dayjs from "dayjs";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function ListaDaVez() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [mesAtual] = useState(dayjs().format("YYYY-MM"));
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState<string>("");

  // Buscar barbeiros cadastrados da rota de profissionais
  const { data: profissionaisResponse, isLoading: isLoadingProfissionais } = useQuery({
    queryKey: ["/api/profissionais"],
    queryFn: async () => {
      const response = await fetch('/api/profissionais');
      if (!response.ok) throw new Error('Erro ao carregar profissionais');
      return response.json();
    }
  });

  // Buscar dados de atendimentos do mês atual
  const { data: atendimentosResponse, isLoading: isLoadingAtendimentos } = useQuery({
    queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual],
    queryFn: async () => {
      const response = await fetch(`/api/lista-da-vez/fila-mensal?mes=${mesAtual}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta do servidor:', errorText);
        throw new Error('Erro ao carregar atendimentos');
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Resposta não é JSON:', textResponse);
        throw new Error('Resposta inválida do servidor');
      }
      
      return response.json();
    },
    staleTime: 30000, // Cache por 30 segundos para reduzir requisições
    refetchInterval: false // Não refetch automático
  });

  const isLoading = isLoadingProfissionais || isLoadingAtendimentos;

  // Combinar dados dos profissionais com atendimentos, mantendo ordem de cadastro
  const barbeiros = profissionaisResponse?.data?.filter((prof: any) => prof.tipo === 'barbeiro' && prof.ativo) || [];
  
  const filaMensal = barbeiros.map((barbeiro: any) => {
    // Buscar dados de atendimentos para este barbeiro
    const atendimentoData = atendimentosResponse?.find((item: any) => 
      item.barbeiro?.id === barbeiro.id
    );

    return {
      barbeiro: {
        id: barbeiro.id,
        nome: barbeiro.nome,
        email: barbeiro.email,
        ativo: barbeiro.ativo
      },
      totalAtendimentosMes: atendimentoData?.totalAtendimentosMes || 0,
      diasPassouAVez: atendimentoData?.diasPassouAVez || 0
    };
  }).sort((a: any, b: any) => {
    // Ordenação: por quantidade de atendimentos (menor para maior)
    // Quando empatados (principalmente quando todos têm 0), mantém ordem de cadastro da API
    if (a.totalAtendimentosMes === b.totalAtendimentosMes) {
      return 0; // Mantém ordem original (ordem de cadastro)
    }
    return a.totalAtendimentosMes - b.totalAtendimentosMes;
  });

  // Adicionar cliente automaticamente para o próximo da fila
  const adicionarCliente = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/lista-da-vez/adicionar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual,
          tipoAtendimento: "NORMAL"
        })
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao adicionar atendimento');
        } else {
          const errorText = await response.text();
          console.error('Erro não-JSON na resposta:', errorText);
          throw new Error('Erro no servidor - resposta inválida');
        }
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual] });
      
      if (data.proximoBarbeiro) {
        toast({
          title: "Atendimento adicionado!",
          description: `Próximo: ${data.proximoBarbeiro.nome}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  });

  // Adicionar cliente manualmente para barbeiro específico
  const adicionarClienteManual = useMutation({
    mutationFn: async () => {
      if (!barbeiroSelecionado) {
        throw new Error("Selecione um barbeiro");
      }

      const response = await fetch('/api/lista-da-vez/adicionar-atendimento-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbeiroId: parseInt(barbeiroSelecionado),
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual,
          tipoAtendimento: "MANUAL"
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao adicionar atendimento manual');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual] });
      setBarbeiroSelecionado("");
      
      toast({
        title: "Atendimento manual adicionado!",
        description: `Barbeiro: ${data.barbeiro.nome}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  });

  // Passar a vez (incrementa +1 atendimento)
  const passarAVez = useMutation({
    mutationFn: async (barbeiroId: number) => {
      const response = await fetch('/api/lista-da-vez/passar-a-vez', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbeiroId: barbeiroId,
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao passar a vez');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual] });

      toast({
        title: "Vez passada!",
        description: `${data.barbeiro.nome} passou a vez (+1 atendimento)`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  });

  const resetarFila = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/lista-da-vez/resetar-fila', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesAno: mesAtual })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao resetar fila');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual] });
      
      toast({
        title: "Fila resetada!",
        description: "Todos os barbeiros voltaram para posição inicial",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  });

  const proximoBarbeiro = filaMensal.length > 0 ? filaMensal[0].barbeiro : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lista da Vez</h1>
            <p className="text-muted-foreground">
              Mês: {dayjs(mesAtual).format("MMMM/YYYY")}
            </p>
          </div>
        </div>

        {/* Cards de Ação */}
        <div className={`grid grid-cols-1 gap-6 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {/* Próximo da Fila */}
          <Card className="bg-card border-border">
            <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-t-xl">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Próximo da Fila
              </CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Barbeiro com menos atendimentos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {proximoBarbeiro ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Scissors className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground">{proximoBarbeiro.nome}</h3>
                    <p className="text-sm text-muted-foreground">{proximoBarbeiro.email}</p>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => adicionarCliente.mutate()}
                      disabled={adicionarCliente.isPending}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {adicionarCliente.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Adicionando...
                        </div>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Cliente
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={() => passarAVez.mutate(proximoBarbeiro.id)}
                      disabled={passarAVez.isPending}
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary/10"
                    >
                      {passarAVez.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          Passando...
                        </div>
                      ) : (
                        <>
                          <Clock className="mr-2 h-4 w-4" />
                          Passo a vez
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Nenhum barbeiro disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Adicionar Manualmente */}
          <Card className="bg-card border-border">
            <CardHeader className="bg-gradient-to-r from-secondary to-secondary/80 text-white rounded-t-xl">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Adicionar Manualmente
              </CardTitle>
              <CardDescription className="text-secondary-foreground/80">
                Escolher barbeiro específico
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Select value={barbeiroSelecionado} onValueChange={setBarbeiroSelecionado}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione um barbeiro" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {filaMensal.map((item: any) => (
                    <SelectItem 
                      key={item.barbeiro.id} 
                      value={item.barbeiro.id.toString()}
                      className="text-popover-foreground hover:bg-accent"
                    >
                      {item.barbeiro.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => adicionarClienteManual.mutate()}
                disabled={adicionarClienteManual.isPending || !barbeiroSelecionado}
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              >
                {adicionarClienteManual.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adicionando...
                  </div>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Resetar Fila - Apenas para Admin */}
          {isAdmin && (
            <Card className="bg-card border-border">
              <CardHeader className="bg-gradient-to-r from-destructive to-destructive/80 text-white rounded-t-xl">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Resetar Fila
                </CardTitle>
                <CardDescription className="text-destructive-foreground/80">
                  Zerar contadores do mês
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Button 
                  variant="destructive"
                  onClick={() => resetarFila.mutate()}
                  disabled={resetarFila.isPending}
                  className="w-full"
                >
                  {resetarFila.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Resetando...
                    </div>
                  ) : (
                    "Resetar Fila"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabela de Atendimento Mensal */}
        <Card className="shadow-sm border border-border/50 bg-card/95 backdrop-blur-sm rounded-xl">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-t-xl p-4">
            <CardTitle className="text-lg">Tabela de Atendimento Mensal</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-sm">
              Controle mensal de atendimentos por barbeiro
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* Header da tabela */}
              <div className="hidden lg:grid lg:grid-cols-5 gap-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/10 font-medium text-primary text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Barbeiro
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Atendimentos
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Dias que Passou
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Posição
                </div>
                <div>Status</div>
              </div>

              {/* Linhas da tabela - Desktop */}
              <div className="hidden lg:block divide-y divide-gray-50">
                {filaMensal.map((item: any, index: number) => (
                  <div key={item.barbeiro.id} className="grid grid-cols-5 gap-4 p-4 hover:bg-primary/5 transition-all duration-200 items-center group">
                    {/* Barbeiro */}
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">{item.barbeiro.nome}</div>
                        <div className="text-xs text-muted-foreground">{item.barbeiro.email}</div>
                      </div>
                    </div>

                    {/* Atendimentos */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground border-secondary/30">
                        {item.totalAtendimentosMes}
                      </Badge>
                    </div>

                    {/* Dias que passou */}
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={item.diasPassouAVez > 3 ? "destructive" : "outline"}
                        className={item.diasPassouAVez > 3 ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-muted/20 text-muted-foreground border-muted/30"}
                      >
                        {item.diasPassouAVez} dias
                      </Badge>
                    </div>

                    {/* Posição */}
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={index === 0 ? "default" : "outline"}
                        className={index === 0 ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground border-muted/30"}
                      >
                        {index + 1}º
                      </Badge>
                    </div>

                    {/* Status */}
                    <div>
                      {index === 0 ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800">
                          Próximo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                          Aguardando
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cards Mobile */}
              <div className="lg:hidden space-y-3 p-4">
                {filaMensal.map((item: any, index: number) => (
                  <Card key={item.barbeiro.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-sm">{item.barbeiro.nome}</div>
                            <div className="text-xs text-muted-foreground">{item.barbeiro.email}</div>
                          </div>
                        </div>
                        {index === 0 ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800">
                            Próximo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                            {index + 1}º
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs mb-1">Atendimentos</div>
                          <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground border-secondary/30">
                            {item.totalAtendimentosMes}
                          </Badge>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs mb-1">Dias que Passou</div>
                          <Badge 
                            variant={item.diasPassouAVez > 3 ? "destructive" : "outline"}
                            className={item.diasPassouAVez > 3 ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-muted/20 text-muted-foreground border-muted/30"}
                          >
                            {item.diasPassouAVez}
                          </Badge>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground text-xs mb-1">Posição</div>
                          <Badge 
                            variant={index === 0 ? "default" : "outline"}
                            className={index === 0 ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground border-muted/30"}
                          >
                            {index + 1}º
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}