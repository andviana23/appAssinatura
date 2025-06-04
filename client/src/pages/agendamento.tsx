import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, Plus, Check, X, Search, CalendarDays, Settings, User, Star } from "lucide-react";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isComandaOpen, setIsComandaOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedBarbeiro, setSelectedBarbeiro] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedServico, setSelectedServico] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [agendamentoToCancel, setAgendamentoToCancel] = useState<Agendamento | null>(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    agendamento: null as Agendamento | null
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timelinePosition, setTimelinePosition] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Padronizar formato da data para evitar divergências
  const dataPadronizada = format(selectedDate, "yyyy-MM-dd");
  
  // Fetch data
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["/api/agendamentos", dataPadronizada],
    queryFn: async () => {
      console.log("Query agendamentos - Data:", dataPadronizada, "QueryKey:", ["/api/agendamentos", dataPadronizada]);
      const response = await fetch(`/api/agendamentos?data=${dataPadronizada}`);
      if (!response.ok) throw new Error("Erro ao buscar agendamentos");
      return response.json();
    },
  });

  const { data: profissionaisData } = useQuery({
    queryKey: ["/api/profissionais"],
  });

  const { data: clientesData } = useQuery({
    queryKey: ["/api/clientes"],
  });

  const { data: servicosData } = useQuery({
    queryKey: ["/api/servicos"],
  });

  // Generate time slots - 08:00 to 20:00
  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Get active barbeiros only (filter by tipo)
  const activeBarbeiros = (profissionaisData?.data || []).filter((profissional: any) => 
    profissional.ativo && profissional.tipo === 'barbeiro'
  );

  // Update current time - update every 30 seconds for better precision
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(timer);
  }, []);

  // Calculate timeline position - alinhamento preciso com timeline 08:00-20:00
  const isTodaySelected = isToday(selectedDate);
  useEffect(() => {
    if (isTodaySelected) {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      const dayStart = 8 * 60; // 8:00 AM
      const dayEnd = 20 * 60 + 30; // 8:30 PM
      
      if (totalMinutes >= dayStart && totalMinutes <= dayEnd) {
        // Calcular posição exata baseada nos slots de tempo disponíveis
        const minutesFromStart = totalMinutes - dayStart;
        const totalDayMinutes = dayEnd - dayStart;
        
        // Cada slot tem 30 minutos, então calculamos o slot atual
        const slotIndex = Math.floor(minutesFromStart / 30);
        const minutesIntoSlot = minutesFromStart % 30;
        
        // Posição precisa: slot + progresso dentro do slot
        const exactPosition = slotIndex + (minutesIntoSlot / 30);
        setTimelinePosition(exactPosition);
      } else {
        setTimelinePosition(null);
      }
    } else {
      setTimelinePosition(null);
    }
  }, [currentTime, isTodaySelected]);

  // Calendar navigation
  const previousMonth = () => {
    setCurrentCalendarDate(subDays(currentCalendarDate, 30));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(addDays(currentCalendarDate, 30));
  };

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(date);
  };

  // Get days for calendar
  const monthStart = startOfMonth(currentCalendarDate);
  const monthEnd = endOfMonth(currentCalendarDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Organize agendamentos by barbeiro and time
  const agendamentosByBarbeiro = Array.isArray(agendamentos) ? agendamentos.reduce((acc: any, agendamento: Agendamento) => {
    const barbeiroId = agendamento.barbeiroId;
    const timeSlot = agendamento.dataHora.split(' ')[1]?.substring(0, 5);
    
    console.log("Processando agendamento:", {
      id: agendamento.id,
      barbeiroId,
      timeSlot,
      dataHora: agendamento.dataHora,
      cliente: agendamento.cliente?.nome,
      servico: agendamento.servico?.nome
    });
    
    if (!acc[barbeiroId]) {
      acc[barbeiroId] = {};
    }
    
    if (timeSlot) {
      acc[barbeiroId][timeSlot] = agendamento;
    }
    
    return acc;
  }, {}) : {};
  
  console.log("Agendamentos organizados por barbeiro:", agendamentosByBarbeiro);
  console.log("Total de agendamentos recebidos:", agendamentos?.length || 0);

  // Check if date has agendamentos
  const hasAgendamentos = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return agendamentos.some((agendamento: Agendamento) => 
      agendamento.dataHora.startsWith(dateString)
    );
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao criar agendamento");
      return response.json();
    },
    onSuccess: async () => {
      // Usar a mesma data padronizada para invalidação
      const dataParaInvalidar = format(selectedDate, "yyyy-MM-dd");
      console.log("Invalidando cache - Data:", dataParaInvalidar, "QueryKey:", ["/api/agendamentos", dataParaInvalidar]);
      
      // Invalidar e refetch imediato para garantir atualização
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      
      // Refetch explícito para garantir dados atualizados
      await queryClient.refetchQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      
      setIsModalOpen(false);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/agendamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      setIsComandaOpen(false);
    },
  });

  const resetForm = () => {
    setSelectedHour("");
    setSelectedBarbeiro("");
    setSelectedCliente("");
    setSelectedServico("");
  };

  const criarAgendamento = () => {
    if (!selectedHour || !selectedBarbeiro || !selectedCliente || !selectedServico) {
      return;
    }

    const dataHora = `${format(selectedDate, "yyyy-MM-dd")} ${selectedHour}:00`;
    
    createMutation.mutate({
      clienteId: parseInt(selectedCliente),
      barbeiroId: parseInt(selectedBarbeiro),
      servicoId: parseInt(selectedServico),
      dataHora,
      status: "AGENDADO",
    });
  };

  const abrirComanda = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setIsComandaOpen(true);
    setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
  };

  const updateStatus = (status: string) => {
    if (selectedAgendamento) {
      updateMutation.mutate({ id: selectedAgendamento.id, status });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, agendamento: Agendamento) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      agendamento,
    });
  };

  const confirmarCancelamento = () => {
    if (agendamentoToCancel) {
      updateMutation.mutate({ id: agendamentoToCancel.id, status: "CANCELADO" });
      setCancelDialogOpen(false);
      setAgendamentoToCancel(null);
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="h-full bg-background text-foreground flex overflow-hidden">
      {/* Área Principal da Agenda - Lado Esquerdo */}
      <div className="flex-1 bg-background flex flex-col h-full min-w-0">
        {/* Cabeçalho da Agenda - Compacto */}
        <div className="bg-card border-b border-border px-3 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/recepcionista-dashboard")}
              className="flex items-center gap-1 hover:bg-muted h-7 px-2"
            >
              <ArrowLeft className="h-3 w-3" />
              <span className="text-xs font-medium">Voltar</span>
            </Button>

            <div className="text-center">
              <h1 className="text-sm font-semibold text-foreground">Agenda do Dia</h1>
              <div className="text-xs text-muted-foreground capitalize">
                {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3 w-3" />
                <span className="ml-1 text-xs">Anterior</span>
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="h-7 px-2 text-xs"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="h-7 px-2"
              >
                <span className="mr-1 text-xs">Próximo</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Grade da Agenda Dark Mode - Full Height */}
        <div className="bg-card relative flex-1 overflow-y-auto">
          {activeBarbeiros.length === 0 ? (
            /* Mensagem quando não há barbeiros */
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum barbeiro disponível para agendamento
                </h3>
                <p className="text-muted-foreground">
                  Cadastre profissionais com o tipo "barbeiro" para visualizar a agenda.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Timeline Indicator - Current Time Line */}
              {isTodaySelected && timelinePosition !== null && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{
                    top: `${64 + (timelinePosition * 24)}px`,
                  }}
                >
                  <div className="flex items-center">
                    <div className="w-[120px] bg-blue-500 h-0.5 relative">
                      <div className="absolute right-0 top-0 w-2 h-2 bg-blue-500 rounded-full transform -translate-y-0.5"></div>
                    </div>
                    <div className="flex-1 bg-blue-500 h-0.5 relative">
                      <div className="absolute left-2 top-0 bg-blue-500 text-white text-xs px-2 py-1 rounded transform -translate-y-5 font-medium shadow-lg">
                        {format(currentTime, "HH:mm")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header com nomes dos barbeiros - Altura reduzida */}
              <div 
                className="grid bg-muted border-b border-border relative z-10"
                style={{ 
                  gridTemplateColumns: `120px repeat(${activeBarbeiros.length}, 1fr)` 
                }}
              >
                <div className="p-2 border-r border-border font-semibold flex items-center gap-2 text-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Horário</span>
                </div>
                {activeBarbeiros.map((barbeiro: Barbeiro) => (
                  <div key={barbeiro.id} className="p-2 border-r border-border text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-6 w-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">
                          {barbeiro.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-semibold text-sm text-foreground truncate w-full">{barbeiro.nome}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Linhas de horário - Full Width */}
          {activeBarbeiros.length > 0 && (
            <div className="h-full overflow-y-auto">
              {timeSlots.map((timeSlot) => (
                <div 
                  key={timeSlot} 
                  className="grid border-b border-border min-h-[24px] hover:bg-muted/30 transition-colors group"
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
                      <div key={barbeiro.id} className="border-r border-border p-1 relative min-h-[24px]">
                        {agendamento ? (
                          <div 
                            className={`
                              ${agendamento.status === "FINALIZADO" ? "bg-green-500/90 hover:bg-green-500" : ""}
                              ${agendamento.status === "CANCELADO" ? "bg-gray-500/90 hover:bg-gray-600" : ""}
                              ${agendamento.status === "AGENDADO" ? "bg-primary/90 hover:bg-primary" : ""}
                              ${selectedAgendamento && selectedAgendamento.id === agendamento.id && isComandaOpen ? "bg-amber-500/90 hover:bg-amber-500" : ""}
                              rounded-md p-2 text-xs h-full transition-all duration-200 cursor-pointer text-white shadow-md hover:shadow-lg
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
                          <button
                            className="w-full h-full flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/50 transition-colors rounded-md group-hover:opacity-100 opacity-0"
                            onClick={() => {
                              setSelectedHour(timeSlot);
                              setSelectedBarbeiro(barbeiro.id.toString());
                              setIsModalOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar do Calendário - Lado Direito */}
      <div className="w-80 bg-card border-l border-border shadow-2xl flex-shrink-0 overflow-y-auto">
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
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Data Selecionada</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
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

      {/* Modal de Novo Agendamento */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md sm:max-w-lg mx-4 rounded-xl shadow-2xl border-0 bg-card">
          <DialogHeader className="text-center pb-6 border-b border-border/50">
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center justify-center gap-3">
              <CalendarDays className="h-6 w-6 text-primary" />
              Novo Agendamento
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-2">
              Preencha os dados para criar um novo agendamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            {/* Data e Hora */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Data e Hora</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Data</label>
                  <input
                    type="date"
                    value={format(selectedDate, "yyyy-MM-dd")}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Horário</label>
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
                  >
                    <option value="">Selecionar horário</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Barbeiro */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Barbeiro</label>
              </div>
              <select
                value={selectedBarbeiro}
                onChange={(e) => setSelectedBarbeiro(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
              >
                <option value="">Selecionar barbeiro</option>
                {activeBarbeiros.map((barbeiro: any) => (
                  <option key={barbeiro.id} value={barbeiro.id.toString()}>
                    {barbeiro.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Cliente</label>
              </div>
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
              >
                <option value="">Selecionar cliente</option>
                {clientesData?.data?.map((cliente: any) => (
                  <option key={cliente.id} value={cliente.id.toString()}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Serviço */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Serviço</label>
              </div>
              <select
                value={selectedServico}
                onChange={(e) => setSelectedServico(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
              >
                <option value="">Selecionar serviço</option>
                {servicosData?.data?.map((servico: any) => (
                  <option key={servico.id} value={servico.id.toString()}>
                    {servico.nome} - {servico.tempoMinutos}min
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/50">
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 border-border hover:bg-muted/50 transition-all"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={criarAgendamento} 
              disabled={createMutation.isPending}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 transition-all shadow-md"
            >
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Criando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Agendar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Comanda */}
      <Dialog open={isComandaOpen} onOpenChange={setIsComandaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comanda de Atendimento</DialogTitle>
          </DialogHeader>
          
          {selectedAgendamento && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Informações do Cliente</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p><strong>Nome:</strong> {selectedAgendamento.cliente?.nome}</p>
                    <p><strong>Serviço:</strong> {selectedAgendamento.servico?.nome}</p>
                    <p><strong>Duração:</strong> {selectedAgendamento.servico?.tempoMinutos} minutos</p>
                    <p><strong>Horário:</strong> {selectedAgendamento.dataHora}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold">Status do Atendimento</h3>
                  <div className="space-y-3">
                    <Button
                      variant={selectedAgendamento.status === "AGENDADO" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => updateStatus("AGENDADO")}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Agendado
                    </Button>
                    <Button
                      variant={selectedAgendamento.status === "FINALIZADO" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => updateStatus("FINALIZADO")}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Finalizado
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cancelamento</DialogTitle>
          </DialogHeader>
          
          {agendamentoToCancel && (
            <div className="space-y-4">
              <p>Tem certeza que deseja cancelar o agendamento?</p>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>Cliente:</strong> {agendamentoToCancel.cliente?.nome}</p>
                <p><strong>Serviço:</strong> {agendamentoToCancel.servico?.nome}</p>
                <p><strong>Data/Hora:</strong> {agendamentoToCancel.dataHora}</p>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                  Manter Agendamento
                </Button>
                <Button variant="destructive" onClick={confirmarCancelamento}>
                  Cancelar Agendamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-card border border-border rounded-md shadow-lg z-50 py-2"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
            onClick={() => {
              if (contextMenu.agendamento) {
                abrirComanda(contextMenu.agendamento);
              }
              setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
            }}
          >
            Abrir Comanda
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors text-destructive"
            onClick={() => {
              if (contextMenu.agendamento) {
                setAgendamentoToCancel(contextMenu.agendamento);
                setCancelDialogOpen(true);
              }
              setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
            }}
          >
            Cancelar Agendamento
          </button>
        </div>
      )}
    </div>
  );
}