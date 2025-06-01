import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Calendar, Trophy, SkipForward } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Barbeiro {
  id: number;
  nome: string;
  ativo: boolean;
}

interface AtendimentoMensal {
  barbeiroId: number;
  barbeiro: Barbeiro;
  totalAtendimentos: number;
  posicaoMensal: number;
  diasPassouAVez: number;
}

export default function ListaDaVezMensal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mesAtual] = useState(() => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: barbeiros = [], isLoading: barbeirosLoading } = useQuery<Barbeiro[]>({
    queryKey: ['/api/barbeiros']
  });

  const { data: filaMensal = [], isLoading: filaLoading } = useQuery<AtendimentoMensal[]>({
    queryKey: ['/api/lista-da-vez/fila-mensal', mesAtual]
  });

  const adicionarAtendimentoMutation = useMutation({
    mutationFn: async (barbeiroId: number) => {
      return apiRequest('/api/lista-da-vez/adicionar-atendimento', {
        method: 'POST',
        body: {
          barbeiroId,
          data: new Date().toISOString().split('T')[0],
          mesAno: mesAtual
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lista-da-vez/fila-mensal'] });
      toast({
        title: "Atendimento adicionado",
        description: "Atendimento manual contabilizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao adicionar",
        description: "Não foi possível adicionar o atendimento.",
        variant: "destructive",
      });
    }
  });

  const passarVezMutation = useMutation({
    mutationFn: async (barbeiroId: number) => {
      return apiRequest('/api/lista-da-vez/passar-vez', {
        method: 'POST',
        body: {
          barbeiroId,
          data: new Date().toISOString().split('T')[0],
          mesAno: mesAtual
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lista-da-vez/fila-mensal'] });
      toast({
        title: "Vez passada",
        description: "Barbeiro passou a vez e foi contabilizado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao passar vez",
        description: "Não foi possível registrar que o barbeiro passou a vez.",
        variant: "destructive",
      });
    }
  });

  // Encontrar o barbeiro da vez (menor número de atendimentos)
  const barbeirosDaVez = filaMensal
    .filter(item => item.barbeiro.ativo)
    .sort((a, b) => a.totalAtendimentos - b.totalAtendimentos);
  
  const menorAtendimentos = barbeirosDaVez[0]?.totalAtendimentos || 0;
  const barbeirosComMenorAtendimento = barbeirosDaVez.filter(
    item => item.totalAtendimentos === menorAtendimentos
  );

  const handleAdicionarAtendimento = (barbeiroId: number) => {
    adicionarAtendimentoMutation.mutate(barbeiroId);
  };

  const handlePassarVez = (barbeiroId: number) => {
    passarVezMutation.mutate(barbeiroId);
  };

  if (barbeirosLoading || filaLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-32" />
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
          <h2 className="text-2xl font-bold text-foreground">Lista da Vez - Atendimento Mensal</h2>
          <p className="text-muted-foreground">
            Controle de atendimentos mensais para organizar a ordem de atendimento
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Barbeiros da Vez em Destaque */}
      {barbeirosComMenorAtendimento.length > 0 && (
        <Card className="border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <Trophy className="h-5 w-5" />
              Barbeiro(s) da Vez
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {barbeirosComMenorAtendimento.map((item) => (
                <Badge 
                  key={item.barbeiroId} 
                  variant="outline" 
                  className="border-yellow-400 text-yellow-700 dark:text-yellow-400 px-3 py-1"
                >
                  {item.barbeiro.nome} ({item.totalAtendimentos} atendimentos)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Atendimentos Mensais */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Tabela de Atendimento Mensal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Controle mensal de atendimentos por barbeiro (reseta automaticamente no dia 1º)
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barbeiro</TableHead>
                  <TableHead className="text-center">Total de Atendimentos</TableHead>
                  <TableHead className="text-center">Posição no Mês</TableHead>
                  <TableHead className="text-center">Vezes que Passou</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filaMensal
                  .filter(item => item.barbeiro.ativo)
                  .sort((a, b) => a.totalAtendimentos - b.totalAtendimentos)
                  .map((item, index) => {
                    const isBarberoDaVez = item.totalAtendimentos === menorAtendimentos;
                    
                    return (
                      <TableRow 
                        key={item.barbeiroId}
                        className={isBarberoDaVez ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.barbeiro.nome}</span>
                            {isBarberoDaVez && (
                              <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-400">
                                DA VEZ
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <span className="text-lg font-semibold">{item.totalAtendimentos}</span>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            {index + 1}º lugar
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">{item.diasPassouAVez}</span>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAdicionarAtendimento(item.barbeiroId)}
                              disabled={adicionarAtendimentoMutation.isPending}
                              className="rounded-lg"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar Cliente
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePassarVez(item.barbeiroId)}
                              disabled={passarVezMutation.isPending}
                              className="rounded-lg"
                            >
                              <SkipForward className="h-3 w-3 mr-1" />
                              Passar Vez
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
          
          {filaMensal.filter(item => item.barbeiro.ativo).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum barbeiro ativo encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Barbeiros Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {filaMensal.filter(item => item.barbeiro.ativo).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Atendimentos no Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              {filaMensal.reduce((total, item) => total + item.totalAtendimentos, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Média de Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {filaMensal.length > 0 
                ? Math.round(filaMensal.reduce((total, item) => total + item.totalAtendimentos, 0) / filaMensal.filter(item => item.barbeiro.ativo).length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}