import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, Check, CalendarDays, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AgendaLateral from "@/components/agenda-lateral";
import { useLocation } from "wouter";

interface Agendamento {
  id: number;
  clienteId: number;
  barbeiroId: number;
  servicoId: number;
  dataHora: string;
  status: string;
  cliente?: { nome: string };
  barbeiro?: { nome: string };
  servico?: { nome: string; tempoMinutos: number };
}

interface Cliente {
  id: number;
  nome: string;
}

interface Barbeiro {
  id: number;
  nome: string;
  ativo: boolean;
}

interface Servico {
  id: number;
  nome: string;
  tempoMinutos: number;
  percentualComissao: number;
}

export default function Agendamento() {
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedBarbeiro, setSelectedBarbeiro] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isComandaOpen, setIsComandaOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [comandaItems, setComandaItems] = useState<{ [key: string]: { quantidade: number; preco: number; nome: string } }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Queries
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["/api/agendamentos", dateString],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?date=${dateString}`);
      if (!response.ok) throw new Error('Erro ao carregar agendamentos');
      return response.json();
    }
  });

  const { data: barbeiros = [] } = useQuery({
    queryKey: ["/api/barbeiros"],
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["/api/clientes/unified"],
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ["/api/servicos/assinatura"],
  });

  const { data: todosServicos = [] } = useQuery({
    queryKey: ["/api/servicos"],
  });

  // Mutations
  const createAgendamento = useMutation({
    mutationFn: (data: any) => 
      apiRequest("/api/agendamentos", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      setIsModalOpen(false);
      toast({ title: "Agendamento criado com sucesso!" });
      // Resetar os campos
      setSelectedCliente("");
      setSelectedBarbeiro("");
      setSelectedServico("");
      setSelectedHour("");
    },
    onError: (error) => {
      console.error("Erro ao criar agendamento:", error);
      toast({ title: "Erro nos dados selecionados, tente novamente", variant: "destructive" });
    },
  });

  const finalizarAtendimento = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/agendamentos/${id}/finalizar`, {
        method: "PATCH",
      }).then(res => {
        if (!res.ok) throw new Error("Erro ao finalizar atendimento");
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      toast({ title: "Atendimento finalizado com sucesso!" });
    },
    onError: (error) => {
      console.error("Erro ao finalizar atendimento:", error);
      toast({ title: "Erro ao finalizar atendimento", variant: "destructive" });
    },
  });

  // Gerar horários de 08:00 às 20:00 em intervalos de 10 minutos
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        if (hour === 20 && minute > 0) break; // Para às 20:00
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const activeBarbeiros = Array.isArray(barbeiros) ? barbeiros.filter((b: Barbeiro) => b.ativo) : [];

  // Agrupar agendamentos por barbeiro e horário
  const agendamentosByBarbeiro = Array.isArray(agendamentos) ? agendamentos.reduce((acc: any, agendamento: Agendamento) => {
    const barbeiroId = agendamento.barbeiroId;
    const timeKey = format(new Date(agendamento.dataHora), "HH:mm");
    
    if (!acc[barbeiroId]) acc[barbeiroId] = {};
    acc[barbeiroId][timeKey] = agendamento;
    
    return acc;
  }, {}) : {};

  // Funções do calendário
  const monthStart = startOfMonth(currentCalendarDate);
  const monthEnd = endOfMonth(currentCalendarDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const previousMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1));
  };

  // Verificar se uma data tem agendamentos
  const hasAgendamentos = (date: Date) => {
    if (!Array.isArray(agendamentos)) return false;
    return agendamentos.some((agendamento: Agendamento) => 
      isSameDay(new Date(agendamento.dataHora), date)
    );
  };

  // Selecionar data no calendário
  const selectCalendarDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateAgendamento = () => {
    if (!selectedCliente || !selectedServico || !selectedHour || !selectedBarbeiro) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    // Validação adicional para garantir que os IDs são válidos
    const clienteId = parseInt(selectedCliente);
    const barbeiroId = parseInt(selectedBarbeiro);
    const servicoId = parseInt(selectedServico);

    if (isNaN(clienteId) || isNaN(barbeiroId) || isNaN(servicoId)) {
      toast({ title: "Erro nos dados selecionados. Tente novamente.", variant: "destructive" });
      return;
    }

    const dataHora = new Date(selectedDate);
    const [hour, minute] = selectedHour.split(":");
    dataHora.setHours(parseInt(hour), parseInt(minute), 0, 0);

    createAgendamento.mutate({
      clienteId: clienteId,
      barbeiroId: barbeiroId,
      servicoId: servicoId,
      dataHora: dataHora.toISOString(),
    });
  };

  const getAgendamentoEndTime = (agendamento: Agendamento) => {
    const startTime = new Date(agendamento.dataHora);
    const endTime = new Date(startTime.getTime() + (agendamento.servico?.tempoMinutos || 30) * 60000);
    return format(endTime, "HH:mm");
  };

  // Produtos fixos para a comanda
  const produtosComanda = [
    { id: 'pomada', nome: 'Pomada', preco: 30.00 },
    { id: 'shampoo', nome: 'Shampoo', preco: 20.00 },
    { id: 'oleo-barba', nome: 'Óleo para barba', preco: 15.00 },
    { id: 'balm', nome: 'Balm', preco: 25.00 },
  ];

  // Funções da comanda
  const abrirComanda = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setComandaItems({});
    setIsComandaOpen(true);
  };

  const adicionarItemComanda = (id: string, nome: string, preco: number) => {
    setComandaItems(prev => ({
      ...prev,
      [id]: {
        quantidade: (prev[id]?.quantidade || 0) + 1,
        preco,
        nome
      }
    }));
  };

  const removerItemComanda = (id: string) => {
    setComandaItems(prev => {
      const newItems = { ...prev };
      if (newItems[id]) {
        newItems[id].quantidade--;
        if (newItems[id].quantidade <= 0) {
          delete newItems[id];
        }
      }
      return newItems;
    });
  };

  const calcularTotalComanda = () => {
    return Object.values(comandaItems).reduce((total, item) => {
      return total + (item.quantidade * item.preco);
    }, 0);
  };

  const finalizarComanda = () => {
    if (selectedAgendamento) {
      // Finalizar o agendamento automaticamente
      finalizarAtendimento.mutate(selectedAgendamento.id);
    }
    toast({ title: "Atendimento finalizado com sucesso!" });
    setIsComandaOpen(false);
    setSelectedAgendamento(null);
    setComandaItems({});
  };

  const fecharComanda = () => {
    setIsComandaOpen(false);
    setSelectedAgendamento(null);
    setComandaItems({});
  };

  // Função para determinar as cores do agendamento baseado no status
  const getAgendamentoColors = (agendamento: Agendamento) => {
    if (agendamento.status === "FINALIZADO") {
      return {
        bg: "bg-gradient-to-r from-green-400 to-green-600",
        border: "border-green-500",
        text: "text-white",
        shadow: "shadow-green-200"
      };
    }
    if (selectedAgendamento && selectedAgendamento.id === agendamento.id && isComandaOpen) {
      return {
        bg: "bg-gradient-to-r from-amber-400 to-orange-500",
        border: "border-amber-500",
        text: "text-white",
        shadow: "shadow-amber-200"
      };
    }
    return {
      bg: "bg-gradient-to-r from-blue-400 to-blue-600",
      border: "border-blue-500",
      text: "text-white",
      shadow: "shadow-blue-200"
    };
  };

  return (
    <div className="flex gap-6 p-6">
      {/* Agenda Principal */}
      <div className="flex-1">
        {/* Cabeçalho Moderno */}
        <div className="bg-gradient-to-r from-[#8B4513] to-[#A0522D] rounded-2xl p-6 mb-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-white hover:text-yellow-200 transition-colors bg-white/10 rounded-xl px-4 py-2 hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>

            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Agenda do Dia</h1>
              <div className="text-xl font-semibold text-yellow-200">
                {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="border-white/30 text-white hover:bg-white/20 hover:text-white bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="ml-1 font-medium">Anterior</span>
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="lg"
                onClick={() => setSelectedDate(new Date())}
                className={isToday(selectedDate) ? "bg-yellow-500 hover:bg-yellow-600 text-[#8B4513] font-bold" : "border-white/30 text-white hover:bg-white/20 hover:text-white bg-white/10"}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="border-white/30 text-white hover:bg-white/20 hover:text-white bg-white/10"
              >
                <span className="mr-1 font-medium">Próximo</span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Indicadores de Status */}
          <div className="mt-6 flex items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-white">
              <div className="w-4 h-4 rounded-full bg-blue-400 shadow-lg"></div>
              <span className="font-medium">Agendado</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-4 h-4 rounded-full bg-amber-400 shadow-lg"></div>
              <span className="font-medium">Em Atendimento</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-4 h-4 rounded-full bg-green-400 shadow-lg"></div>
              <span className="font-medium">Finalizado</span>
            </div>
          </div>
        </div>

        {/* Grade da Agenda Moderna */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header com nomes dos barbeiros */}
          <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(180px,1fr))] bg-gradient-to-r from-[#8B4513] to-[#A0522D] text-white shadow-lg">
            <div className="p-4 border-r border-white/20 font-bold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário
            </div>
            {activeBarbeiros.map((barbeiro: Barbeiro) => (
              <div key={barbeiro.id} className="p-4 border-r border-white/20 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {barbeiro.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-bold text-sm">{barbeiro.nome}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Linhas de horário */}
          <div className="max-h-[600px] overflow-y-auto">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className="grid grid-cols-[100px_repeat(auto-fit,minmax(180px,1fr))] border-b border-gray-100 min-h-[80px] hover:bg-gray-50/50 transition-colors">
                <div className="p-4 border-r border-gray-100 text-sm font-bold text-[#8B4513] flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {timeSlot}
                  </div>
                </div>
                
                {activeBarbeiros.map((barbeiro: Barbeiro) => {
                  const agendamento = agendamentosByBarbeiro[barbeiro.id]?.[timeSlot];
                  
                  return (
                    <div key={barbeiro.id} className="border-r border-gray-200 p-1 relative">
                      {agendamento ? (
                        <div 
                          className={`${getAgendamentoColors(agendamento).bg} ${getAgendamentoColors(agendamento).border} ${getAgendamentoColors(agendamento).shadow} border-2 rounded-xl p-3 text-xs h-full cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg`}
                          onClick={() => abrirComanda(agendamento)}
                        >
                          <div className={`font-bold ${getAgendamentoColors(agendamento).text} text-sm`}>
                            🕐 {timeSlot} – {getAgendamentoEndTime(agendamento)}
                          </div>
                          <div className={`${getAgendamentoColors(agendamento).text} font-semibold text-sm mt-1`}>
                            👤 {agendamento.cliente?.nome}
                          </div>
                          <div className={`${getAgendamentoColors(agendamento).text} text-xs mt-1 opacity-90`}>
                            ✂️ {agendamento.servico?.nome} ({agendamento.servico?.tempoMinutos}min)
                          </div>
                          
                          {agendamento.status === "FINALIZADO" ? (
                            <div className="mt-2 flex items-center justify-center bg-white/20 rounded-lg py-1">
                              <div className="text-white font-bold text-xs flex items-center">
                                ✅ FINALIZADO
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="mt-2 w-full h-6 px-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 text-xs font-medium transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                finalizarAtendimento.mutate(agendamento.id);
                              }}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Finalizar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                          <DialogTrigger asChild>
                            <button
                              className="w-full h-full hover:bg-gray-50 flex items-center justify-center"
                              onClick={() => {
                                setSelectedHour(timeSlot);
                                setSelectedBarbeiro(barbeiro.id.toString());
                              }}
                            >
                              <Plus className="h-4 w-4 text-gray-400" />
                            </button>
                          </DialogTrigger>
                        </Dialog>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Agendamento */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Data e Horário</label>
              <div className="text-sm text-gray-600">
                {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedHour}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Barbeiro</label>
              <div className="text-sm text-gray-600">
                {activeBarbeiros.find(b => b.id.toString() === selectedBarbeiro)?.nome}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Cliente</label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(clientes) ? clientes.map((cliente: any) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()}>
                      {cliente.nome}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Serviço</label>
              <Select value={selectedServico} onValueChange={setSelectedServico} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(servicos) ? servicos.map((servico: any) => (
                    <SelectItem key={servico.id} value={servico.id.toString()}>
                      {servico.nome} ({servico.tempoMinutos}min)
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#8B4513] hover:bg-[#A0522D]"
                disabled={createAgendamento.isPending}
                onClick={handleCreateAgendamento}
              >
                {createAgendamento.isPending ? "Criando..." : "Agendar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Agenda Lateral */}
      <div className="w-80">
        <AgendaLateral
          agendamentos={Array.isArray(agendamentos) ? agendamentos.map((agendamento: Agendamento) => ({
            data: format(new Date(agendamento.dataHora), "yyyy-MM-dd")
          })) : []}
          onDataSelecionada={(data) => {
            setSelectedDate(data);
          }}
        />
      </div>

      {/* Modal da Comanda */}
      <Dialog open={isComandaOpen} onOpenChange={setIsComandaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100">
          <DialogHeader className="border-b pb-4 mb-6">
            <DialogTitle className="text-2xl font-bold text-[#8B4513] flex items-center gap-3">
              📋 Comanda - {selectedAgendamento?.cliente?.nome}
            </DialogTitle>
            <div className="text-sm text-gray-600 bg-white rounded-lg p-3 shadow-sm">
              <strong>📅 Data:</strong> {selectedAgendamento && format(new Date(selectedAgendamento.dataHora), "dd/MM/yyyy", { locale: ptBR })} | 
              <strong> ⏰ Horário:</strong> {selectedAgendamento && format(new Date(selectedAgendamento.dataHora), "HH:mm")} |
              <strong> 💼 Profissional:</strong> {selectedAgendamento?.barbeiro?.nome}
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seção Serviços */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-[#8B4513] mb-4 flex items-center gap-2 border-b pb-2">
                ✂️ Serviços Disponíveis
              </h3>
              <div className="space-y-3">
                {Array.isArray(todosServicos) && todosServicos.map((servico) => (
                  <div key={servico.id} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-[#8B4513] transition-all duration-200 hover:shadow-md">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{servico.nome}</div>
                      <div className="text-sm text-gray-600">{servico.tempoMinutos} min</div>
                      <div className="text-lg font-bold text-[#8B4513]">R$ {servico.preco?.toFixed(2) || '0,00'}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 p-0 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                        onClick={() => removerItemComanda(servico.id.toString())}
                        disabled={!comandaItems[servico.id.toString()]?.quantidade}
                      >
                        ➖
                      </Button>
                      <span className="w-12 text-center font-bold text-xl text-[#8B4513] bg-gray-100 rounded-lg py-2">
                        {comandaItems[servico.id.toString()]?.quantidade || 0}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 p-0 text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400"
                        onClick={() => adicionarItemComanda(servico.id.toString(), servico.nome, servico.preco || 0)}
                      >
                        ➕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção Produtos */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-[#8B4513] mb-4 flex items-center gap-2 border-b pb-2">
                🧴 Produtos Disponíveis
              </h3>
              <div className="space-y-3">
                {produtosComanda.map((produto) => (
                  <div key={produto.id} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-[#8B4513] transition-all duration-200 hover:shadow-md">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{produto.nome}</div>
                      <div className="text-lg font-bold text-[#8B4513]">R$ {produto.preco.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 p-0 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                        onClick={() => removerItemComanda(produto.id)}
                        disabled={!comandaItems[produto.id]?.quantidade}
                      >
                        ➖
                      </Button>
                      <span className="w-12 text-center font-bold text-xl text-[#8B4513] bg-gray-100 rounded-lg py-2">
                        {comandaItems[produto.id]?.quantidade || 0}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 p-0 text-green-600 border-green-300 hover:bg-green-50 hover:border-green-400"
                        onClick={() => adicionarItemComanda(produto.id, produto.nome, produto.preco)}
                      >
                        ➕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo da Comanda */}
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-[#8B4513] mb-4 flex items-center gap-2 border-b pb-2">
              📊 Resumo da Comanda
            </h3>
            {Object.keys(comandaItems).length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {Object.entries(comandaItems).map(([id, item]) => (
                    <div key={id} className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg">
                      <span className="font-medium">{item.quantidade}x {item.nome}</span>
                      <span className="font-bold text-[#8B4513]">R$ {(item.quantidade * item.preco).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <hr className="border-2 border-gray-200" />
                <div className="flex justify-between items-center text-2xl font-bold text-white bg-gradient-to-r from-green-600 to-green-700 p-4 rounded-xl shadow-lg">
                  <span>💰 TOTAL GERAL:</span>
                  <span>R$ {calcularTotalComanda().toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📝</div>
                <p className="font-medium">Nenhum item adicionado à comanda</p>
                <p className="text-sm">Selecione serviços ou produtos acima</p>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button 
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 text-lg font-bold shadow-lg"
              onClick={finalizarComanda}
              disabled={Object.keys(comandaItems).length === 0}
            >
              ✅ Finalizar Comanda
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-2 border-gray-300 hover:bg-gray-50 py-4 text-lg font-bold"
              onClick={fecharComanda}
            >
              ❌ Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}