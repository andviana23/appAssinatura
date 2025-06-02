import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, Check, CalendarDays, ArrowLeft, Clock, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [agendamentoToCancel, setAgendamentoToCancel] = useState<Agendamento | null>(null);
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

  const cancelarAgendamento = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/agendamentos/${id}/cancelar`, {
        method: "PATCH",
      }).then(res => {
        if (!res.ok) throw new Error("Erro ao cancelar agendamento");
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comissao"] });
      toast({ title: "Agendamento cancelado com sucesso!" });
      setCancelDialogOpen(false);
      setAgendamentoToCancel(null);
    },
    onError: (error) => {
      console.error("Erro ao cancelar agendamento:", error);
      toast({ title: "Erro ao cancelar agendamento", variant: "destructive" });
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Calendário Lateral - Igual à imagem */}
      <div className="w-72 bg-white shadow-xl">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-[#1e3a8a]">Calendário</h2>
        </div>
        
        {/* Mini Calendário */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={previousMonth} className="p-2 hover:bg-gray-100 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-sm">
              {format(currentCalendarDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
              <div key={day} className="p-1 font-medium text-gray-500">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map(date => (
              <button
                key={date.toISOString()}
                onClick={() => selectCalendarDate(date)}
                className={`
                  p-2 text-xs rounded hover:bg-blue-100 transition-colors
                  ${isSameDay(date, selectedDate) ? 'bg-[#1e3a8a] text-white' : ''}
                  ${isToday(date) ? 'font-bold bg-blue-100' : ''}
                  ${hasAgendamentos(date) ? 'bg-green-100' : ''}
                `}
              >
                {format(date, "d")}
              </button>
            ))}
          </div>
        </div>
        
        {/* Navegação de Data */}
        <div className="p-4 border-t">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => selectCalendarDate(subDays(selectedDate, 1))}
              className="flex-1 p-2 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              ← Anterior
            </button>
            <button
              onClick={() => selectCalendarDate(new Date())}
              className="flex-1 p-2 bg-[#1e3a8a] text-white hover:bg-[#1e40af] rounded text-xs"
            >
              Hoje
            </button>
            <button
              onClick={() => selectCalendarDate(addDays(selectedDate, 1))}
              className="flex-1 p-2 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Próximo →
            </button>
          </div>
          
          {/* Informações da Data Selecionada */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Data Selecionada</h3>
            <div className="text-xs text-center text-gray-500 mb-3">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </div>
            
            <div className="space-y-2">
              <button className="w-full p-2 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                Horários disponíveis
              </button>
              <button className="w-full p-2 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                Lista de Espera
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Área Principal da Agenda - Sem cabeçalho duplo */}
      <div className="flex-1">
        {/* Cabeçalho Moderno */}
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-2xl m-6 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLocation("/recepcionista-dashboard")}
              className="flex items-center gap-2 text-white hover:text-blue-100 transition-colors bg-white/10 rounded-xl px-4 py-2 hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>

            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Agenda do Dia</h1>
              <div className="text-xl font-semibold text-blue-100">
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
                className={isToday(selectedDate) ? "bg-white text-[#1e3a8a] hover:bg-blue-50 font-bold" : "border-white/30 text-white hover:bg-white/20 hover:text-white bg-white/10"}
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

        {/* Grade da Agenda Moderna - Compacta para caber todos os barbeiros */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mx-6">
          {/* Header com nomes dos barbeiros */}
          <div 
            className="grid bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] text-white shadow-lg"
            style={{ 
              gridTemplateColumns: `100px repeat(${activeBarbeiros.length}, 1fr)` 
            }}
          >
            <div className="p-3 border-r border-white/20 font-bold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Horário</span>
            </div>
            {activeBarbeiros.map((barbeiro: Barbeiro) => (
              <div key={barbeiro.id} className="p-3 border-r border-white/20 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">
                      {barbeiro.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-bold text-xs truncate w-full">{barbeiro.nome}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Linhas de horário - Compactas */}
          <div className="max-h-[70vh] overflow-y-auto">
            {timeSlots.map((timeSlot) => (
              <div 
                key={timeSlot} 
                className="grid border-b border-gray-100 min-h-[60px] hover:bg-gray-50/50 transition-colors"
                style={{ 
                  gridTemplateColumns: `100px repeat(${activeBarbeiros.length}, 1fr)` 
                }}
              >
                <div className="p-2 border-r border-gray-100 text-xs font-bold text-[#1e3a8a] flex items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100">
                  <div className="flex items-center gap-1">
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
                          className={`${getAgendamentoColors(agendamento).bg} ${getAgendamentoColors(agendamento).border} border rounded-md p-1 text-xs h-full transition-all duration-200 group relative`}
                        >
                          <div 
                            className="cursor-pointer"
                            onClick={() => abrirComanda(agendamento)}
                          >
                            <div className={`font-bold ${getAgendamentoColors(agendamento).text} text-xs truncate`}>
                              {agendamento.cliente?.nome}
                            </div>
                            <div className={`${getAgendamentoColors(agendamento).text} text-xs truncate`}>
                              {agendamento.servico?.nome}
                            </div>
                            
                            {agendamento.status === "FINALIZADO" && (
                              <div className="text-xs font-bold opacity-80">
                                ✅
                              </div>
                            )}
                          </div>
                          
                          {agendamento.status !== "FINALIZADO" && agendamento.status !== "CANCELADO" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAgendamentoToCancel(agendamento);
                                setCancelDialogOpen(true);
                              }}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                              title="Cancelar agendamento"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                          <DialogTrigger asChild>
                            <button
                              className="w-full h-full hover:bg-gray-50 flex items-center justify-center transition-colors"
                              onClick={() => {
                                setSelectedHour(timeSlot);
                                setSelectedBarbeiro(barbeiro.id.toString());
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <div className="relative flex flex-col items-center gap-1">
                                <div className="h-8 w-8 rounded-full bg-gray-100 group-hover:bg-[#8B4513]/10 flex items-center justify-center transition-colors duration-300">
                                  <Plus className="h-4 w-4 text-gray-400 group-hover:text-[#8B4513] transition-colors duration-300" />
                                </div>
                                <span className="text-xs font-medium text-gray-400 group-hover:text-[#8B4513] transition-colors duration-300">
                                  Agendar
                                </span>
                              </div>
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



      {/* Modal de Agendamento Modernizado */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl shadow-2xl border-0">
          <DialogHeader className="text-center pb-6">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold text-[#1e3a8a]">Novo Agendamento</DialogTitle>
            <p className="text-gray-600 mt-2">Preencha os dados para agendar o cliente</p>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-3 block">📅 Data e Horário</label>
              <div className="p-4 bg-gradient-to-r from-[#1e3a8a]/5 to-[#1e40af]/5 rounded-xl border-2 border-[#1e3a8a]/20">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-[#8B4513]" />
                  <span className="font-semibold text-[#8B4513]">
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedHour}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 mb-3 block">💼 Barbeiro</label>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {activeBarbeiros.find(b => b.id.toString() === selectedBarbeiro)?.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-semibold text-blue-700">
                    {activeBarbeiros.find(b => b.id.toString() === selectedBarbeiro)?.nome}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 mb-3 block">👤 Cliente</label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente} required>
                <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-[#8B4513] rounded-xl">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {Array.isArray(clientes) ? clientes.map((cliente: any) => (
                    <SelectItem key={cliente.id} value={cliente.id.toString()} className="rounded-lg">
                      {cliente.nome}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 mb-3 block">✂️ Serviço</label>
              <Select value={selectedServico} onValueChange={setSelectedServico} required>
                <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-[#8B4513] rounded-xl">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {Array.isArray(servicos) ? servicos.map((servico: any) => (
                    <SelectItem key={servico.id} value={servico.id.toString()} className="rounded-lg">
                      {servico.nome} ({servico.tempoMinutos}min)
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 border-2 border-gray-200 hover:bg-gray-50 rounded-xl font-semibold"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 h-12 bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#A0522D] hover:to-[#8B4513] text-white rounded-xl font-bold shadow-lg transform hover:scale-105 transition-all duration-200"
                disabled={createAgendamento.isPending}
                onClick={handleCreateAgendamento}
              >
{createAgendamento.isPending ? "Criando..." : "✅ AGENDAR"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      


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

      {/* Modal de Confirmação de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl shadow-2xl border-0">
          <DialogHeader className="text-center pb-6">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold text-red-600">Cancelar Agendamento</DialogTitle>
            <p className="text-gray-600 mt-2">Tem certeza que deseja cancelar este agendamento?</p>
          </DialogHeader>
          
          {agendamentoToCancel && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">
                      {agendamentoToCancel.cliente?.nome?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {agendamentoToCancel.cliente?.nome}
                    </div>
                    <div className="text-sm text-gray-600">
                      {agendamentoToCancel.servico?.nome}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Data:</strong> {format(new Date(agendamentoToCancel.dataHora), "dd/MM/yyyy", { locale: ptBR })} | 
                  <strong> Horário:</strong> {format(new Date(agendamentoToCancel.dataHora), "HH:mm")} |
                  <strong> Profissional:</strong> {agendamentoToCancel.barbeiro?.nome}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Atenção:</strong> O cancelamento irá automaticamente remover qualquer comissão relacionada a este atendimento.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 border-2 border-gray-200 hover:bg-gray-50 rounded-xl font-semibold"
                  onClick={() => setCancelDialogOpen(false)}
                >
                  Manter Agendamento
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold shadow-lg"
                  disabled={cancelarAgendamento.isPending}
                  onClick={() => agendamentoToCancel && cancelarAgendamento.mutate(agendamentoToCancel.id)}
                >
                  {cancelarAgendamento.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}