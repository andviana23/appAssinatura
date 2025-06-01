import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, RotateCcw, UserPlus, Trash2, ArrowLeft, User, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import dayjs from "dayjs";

export default function ListaDaVez() {
  const { toast } = useToast();
  const { isAdmin, isRecepcionista } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [mesAtual] = useState(dayjs().format("YYYY-MM"));
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState<string>("");

  // Buscar fila mensal
  const { data: filaMensal = [], isLoading } = useQuery({
    queryKey: ["/api/lista-da-vez/fila-mensal", mesAtual],
    queryFn: async () => {
      const response = await fetch(`/api/lista-da-vez/fila-mensal?mes=${mesAtual}`);
      if (!response.ok) throw new Error('Erro ao carregar fila mensal');
      return response.json();
    }
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
      if (!response.ok) throw new Error('Erro ao adicionar cliente');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: `Cliente adicionado para ${data.barbeiroNome}!`,
        description: "O próximo barbeiro da fila foi selecionado automaticamente."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar cliente", variant: "destructive" });
    }
  });

  // Adicionar cliente para barbeiro específico
  const adicionarClienteEspecifico = useMutation({
    mutationFn: async (barbeiroId: number) => {
      const response = await fetch('/api/lista-da-vez/adicionar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbeiroId,
          data: dayjs().format("YYYY-MM-DD"),
          mesAno: mesAtual,
          tipoAtendimento: "NORMAL"
        })
      });
      if (!response.ok) throw new Error('Erro ao adicionar cliente');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: `Cliente adicionado para ${data.barbeiroNome}!`,
        description: "Barbeiro selecionado manualmente."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
      setBarbeiroSelecionado("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar cliente", variant: "destructive" });
    }
  });

  // Zerar todos os atendimentos (apenas admin)
  const zerarAtendimentos = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/lista-da-vez/zerar-atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesAno: mesAtual })
      });
      if (!response.ok) throw new Error('Erro ao zerar atendimentos');
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Atendimentos zerados com sucesso!",
        description: "Todos os registros do mês foram removidos."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
    },
    onError: () => {
      toast({ title: "Erro ao zerar atendimentos", variant: "destructive" });
    }
  });

  // Adicionar atendimento manual para barbeiro específico
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
    onSuccess: (data) => {
      toast({ 
        title: `Cliente adicionado para ${data.barbeiroNome}!`,
        description: "Atendimento manual registrado."
      });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">Lista da Vez</h1>
                <p className="text-gray-600 mt-1">Controle mensal de atendimentos</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex items-center space-x-4 text-sm bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg">
              <Calendar className="h-4 w-4 text-[#365e78]" />
              <span className="font-medium text-[#365e78]">{dayjs().format("MMMM [de] YYYY")}</span>
            </div>
            {(isAdmin || isRecepcionista) && (
              <div className="flex flex-col lg:flex-row gap-3">
                <Button
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  onClick={() => adicionarCliente.mutate()}
                  disabled={adicionarCliente.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {adicionarCliente.isPending ? 'Adicionando...' : 'Adicionar Próximo Cliente'}
                </Button>
                
                <div className="flex gap-2">
                  <Select value={barbeiroSelecionado} onValueChange={setBarbeiroSelecionado}>
                    <SelectTrigger className="w-48 bg-white/90 backdrop-blur-sm border-2 border-[#365e78]/20 shadow-lg">
                      <SelectValue placeholder="Escolher barbeiro" />
                    </SelectTrigger>
                    <SelectContent>
                      {filaMensal.map((item: any) => (
                        <SelectItem key={item.barbeiro.id} value={item.barbeiro.id.toString()}>
                          {item.barbeiro.nome} ({item.totalAtendimentosMes})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    onClick={() => {
                      if (barbeiroSelecionado) {
                        adicionarClienteEspecifico.mutate(parseInt(barbeiroSelecionado));
                      }
                    }}
                    disabled={!barbeiroSelecionado || adicionarClienteEspecifico.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {adicionarClienteEspecifico.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </div>

                {isAdmin && (
                  <Button
                    variant="destructive"
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja zerar todos os atendimentos do mês?')) {
                        zerarAtendimentos.mutate();
                      }
                    }}
                    disabled={zerarAtendimentos.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {zerarAtendimentos.isPending ? 'Zerando...' : 'Zerar Mês'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Estatísticas Resumidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-lg flex items-center justify-center shadow-md">
                  <UserCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total de Barbeiros</p>
                  <p className="text-xl font-bold text-[#365e78]">{totalBarbeiros}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total de Atendimentos</p>
                  <p className="text-xl font-bold text-green-600">{totalAtendimentos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                  <RotateCcw className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Média por Barbeiro</p>
                  <p className="text-xl font-bold text-orange-600">{mediaAtendimentos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Atendimento Mensal */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] text-white rounded-t-lg">
            <CardTitle className="text-xl">Tabela de Atendimento Mensal</CardTitle>
            <CardDescription className="text-blue-100">
              Controle mensal de atendimentos por barbeiro (reseta automaticamente no dia 1º)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* Header da tabela */}
              <div className="hidden lg:grid lg:grid-cols-5 gap-6 p-6 bg-gradient-to-r from-[#365e78]/5 to-[#2a4a5e]/5 border-b-2 border-[#365e78]/10 font-bold text-[#365e78] text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Barbeiro
                </div>
                <div className="text-center">Posição</div>
                <div className="text-center">Atendimentos</div>
                <div className="text-center">Passou a Vez</div>
                <div className="text-center">Ações</div>
              </div>

              {/* Linhas da tabela - Desktop */}
              <div className="hidden lg:block divide-y divide-gray-100">
                {filaMensal.map((item: any, index: number) => (
                  <div key={item.barbeiro.id} className="grid grid-cols-5 gap-6 p-6 hover:bg-[#365e78]/5 transition-all duration-200 items-center group">
                    {/* Barbeiro */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-xl flex items-center justify-center shadow-md">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{item.barbeiro.nome}</div>
                        <div className="text-xs text-gray-500 truncate">{item.barbeiro.email}</div>
                      </div>
                    </div>

                    {/* Ranking */}
                    <div className="text-center">
                      <Badge 
                        variant="outline" 
                        className={`${getPositionBadge(item.posicaoMensal)} px-3 py-1 font-bold text-sm shadow-lg`}
                      >
                        {item.posicaoMensal}º
                      </Badge>
                    </div>

                    {/* Total de Atendimentos */}
                    <div className="text-center">
                      <div className="bg-white rounded-xl p-3 shadow-md border border-gray-100">
                        <span className="text-2xl font-bold text-[#365e78]">{item.totalAtendimentosMes}</span>
                        <div className="text-xs text-gray-500 mt-1">total</div>
                      </div>
                    </div>

                    {/* Vezes que Passou */}
                    <div className="text-center">
                      <div className="bg-white rounded-xl p-3 shadow-md border border-gray-100">
                        <span className="text-2xl font-bold text-orange-600">{item.diasPassouAVez}</span>
                        <div className="text-xs text-gray-500 mt-1">vezes</div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-center space-x-3">
                      {(isAdmin || isRecepcionista) && (
                        <>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                            onClick={() => adicionarAtendimento.mutate(item.barbeiro.id)}
                            disabled={adicionarAtendimento.isPending}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Cliente
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-2 border-orange-400 text-orange-600 hover:bg-orange-50 hover:border-orange-500 px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                            onClick={() => passarVez.mutate(item.barbeiro.id)}
                            disabled={passarVez.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Passar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Versão Mobile - Cards */}
              <div className="lg:hidden space-y-4 p-4">
                {filaMensal.map((item: any, index: number) => (
                  <div key={item.barbeiro.id} className="bg-white/90 backdrop-blur-sm border-0 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-lg flex items-center justify-center shadow-md">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{item.barbeiro.nome}</div>
                          <div className="text-sm text-gray-500 truncate">{item.barbeiro.email}</div>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${getPositionBadge(item.posicaoMensal)} px-2 py-1 font-bold text-xs shadow-md`}
                      >
                        {item.posicaoMensal}º
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center bg-gradient-to-br from-[#365e78]/5 to-[#2a4a5e]/5 rounded-lg p-3 border border-[#365e78]/10">
                        <div className="text-xl font-bold text-[#365e78]">{item.totalAtendimentosMes}</div>
                        <div className="text-xs text-gray-500 mt-1">Atendimentos</div>
                      </div>
                      <div className="text-center bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                        <div className="text-xl font-bold text-orange-600">{item.diasPassouAVez}</div>
                        <div className="text-xs text-gray-500 mt-1">Passou a Vez</div>
                      </div>
                    </div>

                    {(isAdmin || isRecepcionista) && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white py-2 shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                          onClick={() => adicionarAtendimento.mutate(item.barbeiro.id)}
                          disabled={adicionarAtendimento.isPending}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar Cliente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border border-orange-400 text-orange-600 hover:bg-orange-50 hover:border-orange-500 py-2 shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                          onClick={() => passarVez.mutate(item.barbeiro.id)}
                          disabled={passarVez.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Passar Vez
                        </Button>
                      </div>
                    )}
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