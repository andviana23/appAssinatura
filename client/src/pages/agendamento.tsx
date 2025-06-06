import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
  
  // Estados para busca de cliente
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // Filtrar clientes com base no termo de busca (nome ou telefone)
  const clientesFiltrados = (clientesData?.data || []).filter((cliente: any) => {
    if (!clienteSearchTerm.trim()) return true;
    const searchLower = clienteSearchTerm.toLowerCase();
    return (
      cliente.nome.toLowerCase().includes(searchLower) ||
      cliente.telefone.includes(clienteSearchTerm.trim())
    );
  });

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

  // Timeline position removida conforme solicitado

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

  // Organize agendamentos by barbeiro and time - corrigido para fuso horário
  const agendamentosByBarbeiro = Array.isArray(agendamentos) ? agendamentos.reduce((acc: any, agendamento: Agendamento) => {
    const barbeiroId = agendamento.barbeiroId;
    
    // Criar data corrigindo o fuso horário (UTC +3 horas para Brazil)
    const dataHoraUTC = new Date(agendamento.dataHora);
    const dataHoraLocal = new Date(dataHoraUTC.getTime() + (3 * 60 * 60 * 1000)); // Adicionar 3 horas
    
    const timeSlot = dataHoraLocal.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false
    });
    
    console.log(`Processando agendamento ID: ${agendamento.id}, BarbeiroID: ${barbeiroId}, TimeSlot: ${timeSlot}, DataHora original: ${agendamento.dataHora}, DataHora corrigida: ${dataHoraLocal}`);
    
    if (!acc[barbeiroId]) {
      acc[barbeiroId] = {};
    }
    
    if (timeSlot) {
      acc[barbeiroId][timeSlot] = agendamento;
    }
    
    return acc;
  }, {}) : {};
  
  console.log("AgendamentosByBarbeiro final:", agendamentosByBarbeiro);
  console.log("ActiveBarbeiros:", activeBarbeiros);
  


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

  // Update mutation para finalizar agendamento
  const finalizarMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/agendamentos/${id}/finalizar`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Erro ao finalizar agendamento");
      return response.json();
    },
    onSuccess: async () => {
      // Invalidar cache e refetch para atualização imediata
      const dataParaInvalidar = format(selectedDate, "yyyy-MM-dd");
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      await queryClient.refetchQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      
      toast({
        title: "Atendimento finalizado!",
        description: "O status do agendamento foi atualizado com sucesso.",
      });
      
      setIsComandaOpen(false);
      setSelectedAgendamento(null);
    },
    onError: (error) => {
      console.error("Erro ao finalizar agendamento:", error);
      toast({
        title: "Erro ao finalizar",
        description: "Não foi possível finalizar o atendimento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update mutation para outros status
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
    onSuccess: async () => {
      const dataParaInvalidar = format(selectedDate, "yyyy-MM-dd");
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      await queryClient.refetchQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      
      setIsComandaOpen(false);
    },
  });

  // Mutation para cancelar agendamento
  const cancelarMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Cancelando agendamento ID:", id);
      const response = await fetch(`/api/agendamentos/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Erro na resposta:", response.status, errorData);
        throw new Error(`Erro ${response.status}: ${errorData}`);
      }
      
      const result = await response.json();
      console.log("Agendamento cancelado com sucesso:", result);
      return result;
    },
    onSuccess: async () => {
      console.log("Processando sucesso do cancelamento...");
      const dataParaInvalidar = format(selectedDate, "yyyy-MM-dd");
      
      // Invalidar e refetch para garantir atualização
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      await queryClient.refetchQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      
      // Invalidar dados de comissão para atualização em tempo real
      await queryClient.invalidateQueries({ queryKey: ["/api/comissao/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/comissao/barbeiros"] });
      
      toast({
        title: "Agendamento cancelado!",
        description: "O agendamento foi cancelado com sucesso.",
      });
      
      // Fechar menu de contexto
      setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
    },
    onError: (error) => {
      console.error("Erro detalhado ao cancelar agendamento:", error);
      toast({
        title: "Erro ao cancelar",
        description: error instanceof Error ? error.message : "Não foi possível cancelar o agendamento. Tente novamente.",
        variant: "destructive",
      });
      
      // Fechar menu de contexto mesmo em caso de erro
      setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
    },
  });

  const resetForm = () => {
    setSelectedHour("");
    setSelectedBarbeiro("");
    setSelectedCliente("");
    setSelectedServico("");
    setClienteSearchTerm("");
    setShowClienteDropdown(false);
  };

  // Funções do menu de contexto
  const handleContextMenu = (e: React.MouseEvent, agendamento: Agendamento) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      agendamento: agendamento
    });
  };

  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, agendamento: null });
  };

  const handleCancelAgendamento = () => {
    if (contextMenu.agendamento) {
      cancelarMutation.mutate(contextMenu.agendamento.id);
    }
  };

  // Fechar menu de contexto ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        hideContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);



  const criarAgendamento = () => {
    if (!selectedHour || !selectedBarbeiro || !selectedCliente || !selectedServico) {
      return;
    }

    // Validar horário permitido (08:00 às 20:00)
    const [hour] = selectedHour.split(':');
    const hourNumber = parseInt(hour);
    
    if (hourNumber < 8 || hourNumber > 20) {
      toast({
        title: "Horário não permitido",
        description: "Agendamentos só são permitidos entre 08:00 e 20:00",
        variant: "destructive",
      });
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
      if (status === "FINALIZADO") {
        // Usar o endpoint específico para finalização
        finalizarMutation.mutate(selectedAgendamento.id);
      } else {
        // Usar endpoint genérico para outros status
        updateMutation.mutate({ id: selectedAgendamento.id, status });
      }
    }
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

  // Close cliente dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.cliente-search-container')) {
        setShowClienteDropdown(false);
      }
    };

    if (showClienteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClienteDropdown]);

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


              {/* Header com nomes dos barbeiros - Altura reduzida */}
              <div 
                className="grid bg-muted border-b border-border relative z-10"
                style={{ 
                  gridTemplateColumns: `80px repeat(${activeBarbeiros.length}, minmax(130px, 1fr))` 
                }}
              >
                <div className="p-2 border-r border-border font-semibold flex items-center gap-2 text-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Horário</span>
                </div>
                {activeBarbeiros.map((barbeiro: Barbeiro) => (
                  <div key={barbeiro.id} className="p-2 border-r border-border text-center min-w-[130px] max-w-[150px]">
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
                    gridTemplateColumns: `80px repeat(${activeBarbeiros.length}, minmax(130px, 1fr))` 
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
                      <div key={barbeiro.id} className="border-r border-border relative min-h-[24px] p-0.5 min-w-[130px] max-w-[150px] overflow-hidden">
                        {agendamento ? (
                          <div 
                            className={`
                              ${agendamento.status === "FINALIZADO" ? "bg-green-500 hover:bg-green-600" : ""}
                              ${agendamento.status === "CANCELADO" ? "bg-gray-500 hover:bg-gray-600" : ""}
                              ${agendamento.status === "AGENDADO" ? "bg-blue-600 hover:bg-blue-700" : ""}
                              ${selectedAgendamento && selectedAgendamento.id === agendamento.id && isComandaOpen ? "bg-amber-500 hover:bg-amber-600" : ""}
                              rounded-md transition-all duration-200 cursor-pointer text-white shadow-sm hover:shadow-md
                              w-full h-full min-h-[22px] flex flex-col justify-center px-1.5 py-1 overflow-hidden
                            `}
                            onClick={() => abrirComanda(agendamento)}
                            onContextMenu={(e) => handleContextMenu(e, agendamento)}
                            title={`${agendamento.cliente?.nome} - ${agendamento.servico?.nome}`}
                          >
                            <div className="flex items-center justify-between w-full overflow-hidden">
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="font-medium text-white text-[10px] leading-tight truncate">
                                  {agendamento.cliente?.nome}
                                </div>
                                <div className="text-white/90 text-[9px] leading-tight truncate mt-0.5">
                                  {agendamento.servico?.nome}
                                </div>
                              </div>
                              
                              {agendamento.status === "FINALIZADO" && (
                                <Check className="h-2.5 w-2.5 text-white/90 flex-shrink-0 ml-1" />
                              )}
                              
                              {agendamento.status === "CANCELADO" && (
                                <X className="h-2.5 w-2.5 text-white/90 flex-shrink-0 ml-1" />
                              )}
                            </div>
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

            {/* Cliente com Busca */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">Cliente</label>
              </div>
              <div className="relative cliente-search-container">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou telefone..."
                    value={clienteSearchTerm}
                    onChange={(e) => {
                      setClienteSearchTerm(e.target.value);
                      setShowClienteDropdown(true);
                      setSelectedCliente("");
                    }}
                    onFocus={() => setShowClienteDropdown(true)}
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background"
                  />
                </div>
                
                {showClienteDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {clientesFiltrados.length > 0 ? (
                      <>
                        {clientesFiltrados.map((cliente: any) => (
                          <div
                            key={cliente.id}
                            className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0"
                            onClick={() => {
                              setSelectedCliente(cliente.id.toString());
                              setClienteSearchTerm(`${cliente.nome} - ${cliente.telefone}`);
                              setShowClienteDropdown(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{cliente.nome}</span>
                              <span className="text-xs text-muted-foreground">{cliente.telefone}</span>
                              {cliente.email && (
                                <span className="text-xs text-muted-foreground">{cliente.email}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-6 text-center text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum cliente encontrado</p>
                        {clienteSearchTerm && (
                          <p className="text-xs mt-1">Tente buscar por nome ou telefone</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            onClick={handleCancelAgendamento}
          >
            Cancelar Agendamento
          </button>
        </div>
      )}
    </div>
  );
}