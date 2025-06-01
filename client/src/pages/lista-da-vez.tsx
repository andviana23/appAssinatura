import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import dayjs from "dayjs";

export default function ListaDaVez() {
  const { toast } = useToast();
  const { isAdmin, isRecepcionista } = useAuth();
  const queryClient = useQueryClient();
  const [mesAtual] = useState(dayjs().format("YYYY-MM"));

  // Buscar fila mensal
  const { data: filaMensal = [], isLoading } = useQuery({
    queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual],
    queryFn: async () => {
      const response = await fetch(`/api/lista-da-vez/fila-mensal?mes=${mesAtual}`);
      if (!response.ok) throw new Error('Erro ao carregar fila mensal');
      return response.json();
    }
  });

  // Adicionar atendimento manual
  const adicionarAtendimento = useMutation({
    mutationFn: async (barbeiroId: number) => {
      const response = await fetch('/api/lista-da-vez/adicionar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbeiroId, 
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual,
          tipoAtendimento: "MANUAL"
        })
      });
      if (!response.ok) throw new Error('Erro ao adicionar atendimento');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Atendimento adicionado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar atendimento", variant: "destructive" });
    }
  });

  // Passar a vez
  const passarVez = useMutation({
    mutationFn: async (barbeiroId: number) => {
      const response = await fetch('/api/lista-da-vez/adicionar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbeiroId, 
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual,
          tipoAtendimento: "PASSOU_VEZ"
        })
      });
      if (!response.ok) throw new Error('Erro ao passar a vez');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Vez passada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
    },
    onError: () => {
      toast({ title: "Erro ao passar a vez", variant: "destructive" });
    }
  });

  const getPositionBadge = (position: number) => {
    const colors = {
      1: "bg-yellow-500 text-white",
      2: "bg-gray-400 text-white", 
      3: "bg-orange-600 text-white",
      4: "bg-blue-500 text-white",
      5: "bg-green-500 text-white"
    };
    return colors[position as keyof typeof colors] || "bg-gray-300 text-gray-700";
  };

  const totalBarbeiros = filaMensal.length;
  const totalAtendimentos = filaMensal.reduce((sum: number, item: any) => sum + item.totalAtendimentosMes, 0);
  const mediaAtendimentos = totalBarbeiros > 0 ? (totalAtendimentos / totalBarbeiros).toFixed(1) : "0";

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lista da Vez - Atendimento Mensal</h1>
            <p className="text-gray-600 mt-2">Controle de atendimentos mensais para organizar a ordem de atendimento</p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{dayjs().format("MMMM [de] YYYY")}</span>
          </div>
        </div>

        {/* Tabela de Atendimento Mensal */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-xl">Tabela de Atendimento Mensal</CardTitle>
            <CardDescription className="text-blue-100">
              Controle mensal de atendimentos por barbeiro (reseta automaticamente no dia 1º)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              {/* Header da tabela */}
              <div className="grid grid-cols-5 gap-4 p-6 bg-gray-50 border-b font-semibold text-gray-700">
                <div>Barbeiro</div>
                <div className="text-center">Total de Atendimentos</div>
                <div className="text-center">Posição no Mês</div>
                <div className="text-center">Vezes que Passou</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Linhas da tabela */}
              <div className="divide-y divide-gray-100">
                {filaMensal.map((item: any, index: number) => (
                  <div key={item.barbeiro.id} className="grid grid-cols-5 gap-4 p-6 hover:bg-gray-50 transition-colors">
                    {/* Barbeiro */}
                    <div>
                      <div className="font-semibold text-gray-900">{item.barbeiro.nome}</div>
                      <div className="text-sm text-gray-500">{item.barbeiro.email}</div>
                    </div>

                    {/* Total de Atendimentos */}
                    <div className="text-center">
                      <Badge 
                        variant="outline" 
                        className={`${getPositionBadge(item.posicaoMensal)} px-3 py-1 font-bold`}
                      >
                        {item.posicaoMensal}º lugar
                      </Badge>
                    </div>

                    {/* Posição no Mês */}
                    <div className="text-center">
                      <span className="text-lg font-bold text-gray-900">{item.totalAtendimentosMes}</span>
                    </div>

                    {/* Vezes que Passou */}
                    <div className="text-center">
                      <span className="text-lg font-bold text-gray-600">{item.diasPassouAVez}</span>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-center space-x-2">
                      {(isAdmin || isRecepcionista) && (
                        <>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => adicionarAtendimento.mutate(item.barbeiro.id)}
                            disabled={adicionarAtendimento.isPending}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar Cliente
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-600 hover:bg-orange-50"
                            onClick={() => passarVez.mutate(item.barbeiro.id)}
                            disabled={passarVez.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Passar Vez
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{totalBarbeiros}</div>
                <div className="text-sm text-gray-600 font-medium">Total de Barbeiros Ativos</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{totalAtendimentos}</div>
                <div className="text-sm text-gray-600 font-medium">Total de Atendimentos no Mês</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{mediaAtendimentos}</div>
                <div className="text-sm text-gray-600 font-medium">Média de Atendimentos</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}