import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BarbeiroAtendimento {
  id: number;
  nome: string;
  email: string;
  atendimentosDiarios: number;
  passouAVez: boolean;
  totalNoMes: number;
  posicaoMensal: number;
}

interface FilaMensalItem {
  barbeiro: {
    id: number;
    nome: string;
    email: string;
  };
  totalAtendimentosMes: number;
  posicaoMensal: number;
  diasPassouAVez: number;
}

export default function ListaDaVezRecepcionista() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [barbeirosAtendimento, setBarbeirosAtendimento] = useState<BarbeiroAtendimento[]>([]);

  // Obter mês atual para calcular totais
  const mesAtual = dataSelecionada.slice(0, 7); // "YYYY-MM"

  // Buscar fila mensal completa
  const { data: filaMensal = [], isLoading: loadingFila } = useQuery({
    queryKey: ['/api/lista-da-vez/fila-mensal', mesAtual],
    enabled: !!mesAtual,
  });

  // Buscar atendimentos da data selecionada
  const { data: atendimentosDia = [], isLoading: loadingAtendimentos } = useQuery({
    queryKey: ['/api/lista-da-vez/atendimentos', dataSelecionada],
    enabled: !!dataSelecionada,
  });

  // Mutation para salvar dados
  const salvarMutation = useMutation({
    mutationFn: async (dados: { data: string; atendimentos: any[] }) => {
      return await apiRequest('/api/lista-da-vez/salvar', 'POST', dados);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: `Lista da Vez salva com sucesso para ${dataSelecionada}`,
      });
      // Invalidar cache para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['/api/lista-da-vez/fila-mensal', mesAtual] });
      queryClient.invalidateQueries({ queryKey: ['/api/lista-da-vez/atendimentos', dataSelecionada] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a Lista da Vez. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Atualizar lista de barbeiros quando dados carregarem
  useEffect(() => {
    if (!Array.isArray(filaMensal) || filaMensal.length === 0) return;

    const listaSegura = Array.isArray(filaMensal) ? filaMensal : [];
    const atendimentosSegura = Array.isArray(atendimentosDia) ? atendimentosDia : [];

    const barbeirosAtualizados = listaSegura.map((item: FilaMensalItem) => {
      // Buscar atendimento específico da data selecionada
      const atendimentoDia = atendimentosSegura.find(
        (a: any) => a.barbeiroId === item.barbeiro.id && a.data === dataSelecionada
      );

      return {
        id: item.barbeiro.id,
        nome: item.barbeiro.nome,
        email: item.barbeiro.email,
        atendimentosDiarios: atendimentoDia?.atendimentosDiarios || 0,
        passouAVez: atendimentoDia?.passouAVez || false,
        totalNoMes: item.totalAtendimentosMes,
        posicaoMensal: item.posicaoMensal,
      };
    });

    setBarbeirosAtendimento(barbeirosAtualizados);
  }, [filaMensal, atendimentosDia, dataSelecionada]);

  // Recalcular totais em tempo real
  const recalcularTotais = (barbeirosAtuais: BarbeiroAtendimento[]) => {
    // Simular cálculo do total mensal para cada barbeiro
    return barbeirosAtuais.map(barbeiro => {
      // O total mensal vem da API, mas precisamos ajustar com os valores editados do dia atual
      let totalAjustado = barbeiro.totalNoMes;
      
      // Remover contribuição do dia atual (se existir)
      const atendimentoDiaOriginal = atendimentosDia.find(
        (a: any) => a.barbeiroId === barbeiro.id && a.data === dataSelecionada
      );
      if (atendimentoDiaOriginal) {
        const contribuicaoOriginal = atendimentoDiaOriginal.atendimentosDiarios + (atendimentoDiaOriginal.passouAVez ? 1 : 0);
        totalAjustado -= contribuicaoOriginal;
      }
      
      // Adicionar nova contribuição do dia atual
      const novaContribuicao = barbeiro.atendimentosDiarios + (barbeiro.passouAVez ? 1 : 0);
      totalAjustado += novaContribuicao;

      return {
        ...barbeiro,
        totalNoMes: totalAjustado
      };
    }).sort((a, b) => {
      // Ordenar conforme regras: menor total primeiro, depois menor "passou a vez", depois alfabético
      if (a.totalNoMes !== b.totalNoMes) {
        return a.totalNoMes - b.totalNoMes;
      }
      // Para simplificar, usar ordem alfabética como desempate
      return a.nome.localeCompare(b.nome);
    }).map((barbeiro, index) => ({
      ...barbeiro,
      posicaoMensal: index + 1
    }));
  };

  // Atualizar valores em tempo real
  const atualizarAtendimentos = (barbeiroId: number, campo: 'atendimentosDiarios' | 'passouAVez', valor: number | boolean) => {
    setBarbeirosAtendimento(prev => {
      const novosAtendimentos = prev.map(barbeiro => 
        barbeiro.id === barbeiroId 
          ? { ...barbeiro, [campo]: valor }
          : barbeiro
      );
      
      return recalcularTotais(novosAtendimentos);
    });
  };

  // Salvar dados
  const handleSalvar = () => {
    const atendimentosParaSalvar = barbeirosAtendimento.map(barbeiro => ({
      barbeiroId: barbeiro.id,
      atendimentosDiarios: barbeiro.atendimentosDiarios,
      passouAVez: barbeiro.passouAVez,
    }));

    salvarMutation.mutate({
      data: dataSelecionada,
      atendimentos: atendimentosParaSalvar,
    });
  };

  const isLoading = loadingFila || loadingAtendimentos;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Lista da Vez
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-gray-500" />
              <Input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="w-auto"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        {/* Tabela de Atendimentos */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Atendimentos - {new Date(dataSelecionada + 'T00:00:00').toLocaleDateString('pt-BR')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p>Carregando...</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barbeiro</TableHead>
                      <TableHead className="text-center">Atendimentos Diários</TableHead>
                      <TableHead className="text-center">Passou a Vez?</TableHead>
                      <TableHead className="text-center">Total no Mês</TableHead>
                      <TableHead className="text-center">Posição Mensal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barbeirosAtendimento.map((barbeiro) => (
                      <TableRow key={barbeiro.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{barbeiro.nome}</p>
                            <p className="text-sm text-gray-500">{barbeiro.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={barbeiro.atendimentosDiarios}
                            onChange={(e) => atualizarAtendimentos(
                              barbeiro.id, 
                              'atendimentosDiarios', 
                              parseInt(e.target.value) || 0
                            )}
                            className="w-20 mx-auto text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={barbeiro.passouAVez}
                            onCheckedChange={(checked) => atualizarAtendimentos(
                              barbeiro.id, 
                              'passouAVez', 
                              !!checked
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {barbeiro.totalNoMes}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                            barbeiro.posicaoMensal === 1 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : barbeiro.posicaoMensal <= 3
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {barbeiro.posicaoMensal}º
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Botão Salvar */}
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={handleSalvar}
                    disabled={salvarMutation.isPending}
                    className="flex items-center gap-2 px-8 py-2"
                    size="lg"
                  >
                    <Save size={20} />
                    {salvarMutation.isPending ? "Salvando..." : "Salvar Lista da Vez"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}