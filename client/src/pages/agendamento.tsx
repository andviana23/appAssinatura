import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, Check, CalendarDays, ArrowLeft, Clock, X, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isComandaOpen, setIsComandaOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [comandaItems, setComandaItems] = useState<{ [key: string]: { quantidade: number; preco: number; nome: string } }>({});
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [agendamentoToCancel, setAgendamentoToCancel] = useState<Agendamento | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agendamento: Agendamento | null }>({ x: 0, y: 0, agendamento: null });
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Update current time every second for timeline indicator
  useEffect(() => {
    const updateTime = () => {
      // Get current time in Brasília timezone (GMT-3)
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      setCurrentTime(brasiliaTime);
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Calculate timeline position based on current Brasília time
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Convert to total minutes from 8:00 AM
    const totalMinutes = (hours * 60) + minutes;
    const startMinutes = 8 * 60; // 8:00 AM in minutes
    const endMinutes = 20 * 60; // 8:00 PM in minutes
    
    // Calculate position as percentage within business hours
    if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
      return null; // Outside business hours
    }
    
    const businessMinutes = totalMinutes - startMinutes;
    const totalBusinessMinutes = endMinutes - startMinutes; // 12 hours = 720 minutes
    const percentage = (businessMinutes / totalBusinessMinutes) * 100;
    
    return percentage;
  };

  const timelinePosition = getCurrentTimePosition();
  const isTodaySelected = isSameDay(selectedDate, currentTime);

  // Queries
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["/api/agendamentos", dateString],
    queryFn: async () => {
      const response = await fetch(`/api/agendamentos?date=${dateString}`);
      if (!response.ok) throw new Error('Erro ao carregar agendamentos');
      return response.json();
    }
  });

  const { data: barbeirosResponse } = useQuery({
    queryKey: ["/api/profissionais"],
  });
  
  // Extract barbeiros from the API response
  const barbeiros = barbeirosResponse?.data || [];

  // Buscar apenas clientes com assinaturas ativas para agendamento
  const { data: clientes = [] } = useQuery({
    queryKey: ["/api/clientes-ativos-agendamento"],
    queryFn: async () => {
      const response = await apiRequest("/api/clientes-ativos-agendamento");
      return await response.json();
    }
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ["/api/servicos/assinatura"],
  });

  const { data: todosServicos = [] } = useQuery({
    queryKey: ["/api/servicos"],
  });

  // Filtrar clientes com base no termo de busca
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearchTerm.trim()) return clientes;
    return clientes.filter((cliente: any) => 
      cliente.nome.toLowerCase().includes(clienteSearchTerm.toLowerCase())
    );
  }, [clientes, clienteSearchTerm]);

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
      setClienteSearchTerm("");
      setShowClienteDropdown(false);
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
  const activeBarbeiros = Array.isArray(barbeiros) ? barbeiros.filter((b: any) => b.ativo && b.tipo === 'barbeiro') : [];

  // Handler para fechar menu de contexto ao clicar fora
  const handleClickOutside = () => {
    setContextMenu({ x: 0, y: 0, agendamento: null });
  };

  // Handler para clique direito no agendamento
  const handleContextMenu = (e: React.MouseEvent, agendamento: Agendamento) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      agendamento: agendamento
    });
  };

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
    const barbeiroId = parseInt(selectedBarbeiro);
    const servicoId = parseInt(selectedServico);

    if (isNaN(barbeiroId) || isNaN(servicoId)) {
      toast({ title: "Erro nos dados selecionados. Tente novamente.", variant: "destructive" });
      return;
    }

    const dataHora = new Date(selectedDate);
    const [hour, minute] = selectedHour.split(":");
    dataHora.setHours(parseInt(hour), parseInt(minute), 0, 0);

    createAgendamento.mutate({
      clienteId: selectedCliente, // Manter como string para permitir "ext_1"
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
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar do Calendário - Dark Mode Premium */}
      <div className="w-80 bg-card border-r border-border shadow-2xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendário
          </h2>
        </div>
        
        {/* Mini Calendário */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={previousMonth} 
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-foreground capitalize">
              {format(currentCalendarDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={nextMonth}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-3">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
              <div key={day} className="p-2 font-medium text-muted-foreground">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map(date => (
              <Button
                key={date.toISOString()}
                variant="ghost"
                size="sm"
                onClick={() => selectCalendarDate(date)}
                className={`
                  h-8 w-8 p-0 text-xs transition-all hover:bg-muted relative
                  ${isSameDay(date, selectedDate) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  ${isToday(date) ? 'font-bold ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                  ${!isSameMonth(date, currentCalendarDate) ? 'text-muted-foreground/50' : ''}
                `}
              >
                {format(date, "d")}
                {hasAgendamentos(date) && (
                  <div className="absolute bottom-0 right-0 h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                )}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Navegação de Data */}
        <div className="p-6 border-t border-border">
          <div className="flex gap-2 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCalendarDate(subDays(selectedDate, 1))}
              className="flex-1"
            >
              <ChevronLeft className="h-3 w-3 mr-1" />
              Anterior
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => selectCalendarDate(new Date())}
              className="flex-1"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCalendarDate(addDays(selectedDate, 1))}
              className="flex-1"
            >
              Próximo
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          
          {/* Informações da Data Selecionada */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Data Selecionada
            </h3>
            <div className="text-sm text-center text-muted-foreground mb-4 font-medium">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </div>
            
            <div className="space-y-2">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <Clock className="h-3 w-3 mr-2" />
                Horários disponíveis
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Search className="h-3 w-3 mr-2" />
                Lista de Espera
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Área Principal da Agenda - Dark Mode Premium */}
      <div className="flex-1 bg-background">
        {/* Cabeçalho Premium Dark */}
        <div className="bg-card border border-border rounded-lg m-6 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/recepcionista-dashboard")}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Voltar</span>
            </Button>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-1">Agenda do Dia</h1>
              <div className="text-lg font-medium text-muted-foreground capitalize">
                {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1">Anterior</span>
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <span className="mr-1">Próximo</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Indicadores de Status */}
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-sm font-medium">Agendado</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-sm font-medium">Em Atendimento</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">Finalizado</span>
            </div>
          </div>
        </div>

        {/* Grade da Agenda Dark Mode - Inspirada nas imagens de referência */}
        <div className="bg-card border border-border rounded-lg shadow-2xl overflow-hidden mx-6 mb-6 relative">
          {/* Timeline Indicator - Current Time Line */}
          {isTodaySelected && timelinePosition !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{
                top: `${64 + (timelinePosition * 0.01 * (timeSlots.length * 70))}px`, // 64px for header height
              }}
            >
              <div className="flex items-center">
                <div className="w-[120px] bg-red-500 h-1 relative">
                  <div className="absolute right-0 top-0 w-3 h-3 bg-red-500 rounded-full transform -translate-y-1"></div>
                </div>
                <div className="flex-1 bg-red-500 h-1 relative">
                  <div className="absolute left-2 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded transform -translate-y-6 font-medium shadow-lg">
                    {format(currentTime, "HH:mm")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header com nomes dos barbeiros */}
          <div 
            className="grid bg-muted border-b border-border relative z-10"
            style={{ 
              gridTemplateColumns: `120px repeat(${activeBarbeiros.length}, 1fr)` 
            }}
          >
            <div className="p-4 border-r border-border font-semibold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Horário</span>
            </div>
            {activeBarbeiros.map((barbeiro: Barbeiro) => (
              <div key={barbeiro.id} className="p-4 border-r border-border text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">
                      {barbeiro.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-foreground truncate w-full">{barbeiro.nome}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Linhas de horário - Dark Mode Premium */}
          <div className="max-h-[80vh] overflow-y-auto">
            {timeSlots.map((timeSlot) => (
              <div 
                key={timeSlot} 
                className="grid border-b border-border min-h-[50px] hover:bg-muted/30 transition-colors group"
                style={{ 
                  gridTemplateColumns: `120px repeat(${activeBarbeiros.length}, 1fr)` 
                }}
              >
                <div className="p-2 border-r border-border text-sm font-semibold text-muted-foreground flex items-center justify-center bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {timeSlot}
                  </div>
                </div>
                
                {activeBarbeiros.map((barbeiro: Barbeiro) => {
                  const agendamento = agendamentosByBarbeiro[barbeiro.id]?.[timeSlot];
                  
                  return (
                    <div key={barbeiro.id} className="border-r border-border p-1 relative">
                      {agendamento ? (
                        <div 
                          className={`
                            ${agendamento.status === "FINALIZADO" ? "bg-green-500/90 hover:bg-green-500" : ""}
                            ${agendamento.status === "CANCELADO" ? "bg-red-500/90 hover:bg-red-500" : ""}
                            ${agendamento.status === "AGENDADO" ? "bg-primary/90 hover:bg-primary" : ""}
                            ${selectedAgendamento && selectedAgendamento.id === agendamento.id && isComandaOpen ? "bg-amber-500/90 hover:bg-amber-500" : ""}
                            rounded-md p-3 text-xs h-full transition-all duration-200 cursor-pointer text-white shadow-md hover:shadow-lg
                          `}
                          onClick={() => abrirComanda(agendamento)}
                          onContextMenu={(e) => handleContextMenu(e, agendamento)}
                        >
                          <div className="font-semibold text-white text-xs truncate mb-1">
                            {agendamento.cliente?.nome}
                          </div>
                          <div className="text-white/90 text-xs truncate">
                            {agendamento.servico?.nome}
                          </div>
                          
                          {agendamento.status === "FINALIZADO" && (
                            <div className="text-xs font-bold mt-1">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          
                          {agendamento.status === "CANCELADO" && (
                            <div className="text-xs font-bold mt-1">
                              <X className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                          <DialogTrigger asChild>
                            <button
                              className="w-full h-full hover:bg-muted/50 transition-all duration-200"
                              onClick={() => {
                                setSelectedHour(timeSlot);
                                setSelectedBarbeiro(barbeiro.id.toString());
                              }}
                            >
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



      {/* Modal de Agendamento - Dark Mode Premium */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border rounded-xl shadow-2xl">
          <DialogHeader className="pb-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-foreground">Novo Agendamento</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Preencha os dados para agendar o cliente</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 pt-6">
            {/* Data e Horário */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Data e Horário</label>
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedHour}
                  </span>
                </div>
              </div>
            </div>

            {/* Barbeiro */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Barbeiro</label>
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-medium text-sm">
                      {activeBarbeiros.find(b => b.id.toString() === selectedBarbeiro)?.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-foreground">
                    {activeBarbeiros.find(b => b.id.toString() === selectedBarbeiro)?.nome}
                  </span>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Cliente</label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Digite o nome do cliente..."
                    value={clienteSearchTerm}
                    onChange={(e) => {
                      setClienteSearchTerm(e.target.value);
                      setShowClienteDropdown(true);
                    }}
                    onFocus={() => setShowClienteDropdown(true)}
                    className="h-11 pl-10 bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {showClienteDropdown && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {clientesFiltrados.map((cliente: any) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => {
                          setSelectedCliente(cliente.id.toString());
                          setClienteSearchTerm(cliente.nome);
                          setShowClienteDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-foreground">{cliente.nome}</div>
                        <div className="text-sm text-muted-foreground">{cliente.email}</div>
                        <div className="text-xs text-primary">{cliente.origem === 'ASAAS' ? 'Cliente Asaas' : 'Cliente Externo'}</div>
                      </button>
                    ))}
                  </div>
                )}
                {showClienteDropdown && clientesFiltrados.length === 0 && clienteSearchTerm && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl p-4">
                    <div className="text-muted-foreground text-center text-sm">Nenhum cliente encontrado</div>
                  </div>
                )}
              </div>
            </div>

            {/* Serviço */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Serviço</label>
              <Select value={selectedServico} onValueChange={setSelectedServico} required>
                <SelectTrigger className="h-11 bg-background border-border focus:border-primary text-foreground">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border shadow-xl">
                  {Array.isArray(servicos) ? servicos.map((servico: any) => (
                    <SelectItem key={servico.id} value={servico.id.toString()} className="text-foreground hover:bg-muted/50">
                      {servico.nome} ({servico.tempoMinutos}min)
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 border-border hover:bg-muted text-foreground"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={createAgendamento.isPending}
              onClick={handleCreateAgendamento}
            >
              {createAgendamento.isPending ? "Criando..." : "Agendar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      


      {/* Modal da Comanda */}
      <Dialog open={isComandaOpen} onOpenChange={setIsComandaOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader className="border-b pb-4 mb-6">
            <DialogTitle className="text-xl font-bold text-[#365e78] flex items-center gap-2">
              📋 Comanda - {selectedAgendamento?.cliente?.nome}
            </DialogTitle>
            <div className="text-sm text-slate-600 flex gap-4">
              <span>📅 {selectedAgendamento && format(new Date(selectedAgendamento.dataHora), "dd/MM/yyyy", { locale: ptBR })}</span>
              <span>⏰ {selectedAgendamento && format(new Date(selectedAgendamento.dataHora), "HH:mm")}</span>
              <span>💼 {selectedAgendamento?.barbeiro?.nome}</span>
            </div>
          </DialogHeader>

          {/* Serviço Agendado */}
          {selectedAgendamento?.servico && (
            <div className="mb-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-[#365e78] mb-3 flex items-center gap-2">
                📋 Serviço Agendado
              </h4>
              <div className="flex items-center justify-between bg-white rounded-lg p-3">
                <div>
                  <div className="font-medium text-slate-800">{selectedAgendamento.servico.nome}</div>
                  <div className="text-sm text-slate-500">{selectedAgendamento.servico.tempoMinutos} min • Incluído</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-lg border-red-200 text-red-500 hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Deseja realmente remover este serviço do agendamento?')) {
                      toast({ title: "Funcionalidade em desenvolvimento", description: "Remoção de serviços agendados será implementada em breve." });
                    }
                  }}
                >
                  🗑️
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Button 
              className="bg-[#365e78] hover:bg-[#2d4a5f] text-white py-3 px-4 rounded-lg"
              onClick={() => {
                toast({ title: "Funcionalidade em desenvolvimento", description: "Seleção de serviços adicionais será implementada em breve." });
              }}
            >
              ➕ Adicionar Serviço
            </Button>
            <Button 
              className="bg-[#365e78] hover:bg-[#2d4a5f] text-white py-3 px-4 rounded-lg"
              onClick={() => {
                toast({ title: "Funcionalidade em desenvolvimento", description: "Seleção de produtos será implementada em breve." });
              }}
            >
              ➕ Adicionar Produto
            </Button>
          </div>

          {/* Resumo da Comanda */}
          {Object.keys(comandaItems).length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-[#365e78] mb-3">📊 Itens Adicionais</h4>
              <div className="space-y-2">
                {Object.entries(comandaItems).map(([id, item]) => (
                  <div key={id} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm">{item.quantidade}x {item.nome}</span>
                    <span className="font-semibold text-[#365e78]">R$ {(item.quantidade * item.preco).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t mt-3 pt-3">
                <div className="flex justify-between items-center bg-[#365e78] text-white p-3 rounded-lg">
                  <span className="font-bold">💰 TOTAL:</span>
                  <span className="text-lg font-bold">R$ {calcularTotalComanda().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 mt-4">
            <Button 
              className="flex-1 bg-[#365e78] hover:bg-[#2d4a5f] text-white py-3 rounded-lg disabled:opacity-50"
              onClick={finalizarComanda}
              disabled={!selectedAgendamento?.servico && Object.keys(comandaItems).length === 0}
            >
              ✅ Finalizar Comanda
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-slate-300 hover:bg-slate-50 py-3 rounded-lg"
              onClick={fecharComanda}
            >
              ❌ Fechar
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

      {/* Menu de Contexto (Clique Direito) */}
      {contextMenu.agendamento && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="font-semibold text-sm text-gray-800">
              {contextMenu.agendamento.cliente?.nome}
            </div>
            <div className="text-xs text-gray-500">
              {contextMenu.agendamento.servico?.nome}
            </div>
            <div className="text-xs text-gray-500">
              {format(new Date(contextMenu.agendamento.dataHora), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                abrirComanda(contextMenu.agendamento);
                setContextMenu({ x: 0, y: 0, agendamento: null });
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📋</span>
              Abrir Comanda
            </button>
            
            <button
              onClick={() => {
                setAgendamentoToCancel(contextMenu.agendamento);
                setCancelDialogOpen(true);
                setContextMenu({ x: 0, y: 0, agendamento: null });
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar Agendamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}