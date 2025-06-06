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

  // Generate time slots - 08:00 to 20:00 (último horário às 20:00)
  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      // Parar no último slot válido (20:00)
      if (hour === 20 && minute > 0) break;
      
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Filtrar clientes com base no termo de busca (nome ou telefone)
  const clientesFiltrados = (clientesData?.data || []).filter((cliente: any) => {
    if (!clienteSearchTerm.trim()) return true;
    const searchLower = clienteSearchTerm.toLowerCase();
    
    // Verificar se nome existe e não é nulo antes de usar toLowerCase
    const nomeMatch = cliente.nome && typeof cliente.nome === 'string' 
      ? cliente.nome.toLowerCase().includes(searchLower) 
      : false;
    
    // Verificar se telefone existe e não é nulo antes de usar includes
    const telefoneMatch = cliente.telefone && typeof cliente.telefone === 'string'
      ? cliente.telefone.includes(clienteSearchTerm.trim())
      : false;
    
    return nomeMatch || telefoneMatch;
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

  // Função para calcular quantos slots de 30 minutos um serviço ocupa
  const calcularSlotsOcupados = (tempoMinutos: number) => {
    return Math.ceil(tempoMinutos / 30); // Cada slot = 30 minutos
  };

  // Função para gerar todos os slots ocupados por um agendamento
  const gerarSlotsOcupados = (horaInicio: string, tempoMinutos: number) => {
    const slots = [];
    const [hora, minuto] = horaInicio.split(':').map(Number);
    const minutosInicio = hora * 60 + minuto;
    
    // Calcular quantos slots de 30 minutos são necessários
    const totalSlots = Math.ceil(tempoMinutos / 30);
    
    for (let i = 0; i < totalSlots; i++) {
      const minutosAtual = minutosInicio + (i * 30);
      const horaAtual = Math.floor(minutosAtual / 60);
      const minutoAtual = minutosAtual % 60;
      
      if (horaAtual >= 8 && horaAtual <= 20) {
        const slotFormatado = `${horaAtual.toString().padStart(2, '0')}:${minutoAtual.toString().padStart(2, '0')}`;
        slots.push(slotFormatado);
      }
    }
    
    return slots;
  };

  // Organize agendamentos by barbeiro and time - com duração do serviço
  const agendamentosByBarbeiro = Array.isArray(agendamentos) ? agendamentos.reduce((acc: any, agendamento: Agendamento) => {
    const barbeiroId = agendamento.barbeiroId;
    
    // Criar data sem ajuste de fuso horário (usar direto do banco)
    const dataHoraOriginal = new Date(agendamento.dataHora);
    
    const timeSlot = dataHoraOriginal.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false
    });
    
    console.log(`📅 Processando agendamento ID: ${agendamento.id}, BarbeiroID: ${barbeiroId}, TimeSlot: ${timeSlot}, Duração: ${agendamento.servico?.tempoMinutos}min`);
    
    if (!acc[barbeiroId]) {
      acc[barbeiroId] = {};
    }
    
    // Calcular todos os slots que este agendamento deve ocupar
    const tempoServico = agendamento.servico?.tempoMinutos || 30;
    const slotsOcupados = gerarSlotsOcupados(timeSlot, tempoServico);
    
    // Marcar o slot principal com o agendamento completo
    if (timeSlot) {
      acc[barbeiroId][timeSlot] = {
        ...agendamento,
        isMainSlot: true,
        slotsOcupados: slotsOcupados,
        duracaoMinutos: tempoServico
      };
    }
    
    // Marcar os slots subsequentes como ocupados (mas sem exibir card)
    slotsOcupados.slice(1).forEach(slot => {
      if (acc[barbeiroId][slot]) {
        // Se já existe um agendamento neste slot, não sobrescrever
        return;
      }
      acc[barbeiroId][slot] = {
        isOccupiedSlot: true,
        parentAgendamento: agendamento,
        parentTimeSlot: timeSlot
      };
    });
    
    return acc;
  }, {}) : {};
  
  console.log("🔄 AgendamentosByBarbeiro final:", agendamentosByBarbeiro);
  console.log("👨‍💼 ActiveBarbeiros:", activeBarbeiros);
  console.log("📊 Total agendamentos recebidos:", agendamentos.length);
  


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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro desconhecido" }));
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: async () => {
      // Usar a mesma data padronizada para invalidação
      const dataParaInvalidar = format(selectedDate, "yyyy-MM-dd");
      console.log("✅ Agendamento criado com sucesso! Invalidando cache...");
      
      // Invalidar e refetch imediato para garantir atualização
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      await queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      
      // Refetch explícito para garantir dados atualizados
      await queryClient.refetchQueries({ queryKey: ["/api/agendamentos", dataParaInvalidar] });
      
      setIsModalOpen(false);
      resetForm();
      
      toast({
        title: "Agendamento criado!",
        description: "O agendamento foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      console.error("❌ Erro ao criar agendamento:", error.message);
      toast({
        title: "Erro ao agendar",
        description: error.message,
        variant: "destructive",
      });
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
      console.log("❌ Campos obrigatórios não preenchidos:", {
        selectedHour,
        selectedBarbeiro,
        selectedCliente,
        selectedServico
      });
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para criar o agendamento",
        variant: "destructive",
      });
      return;
    }

    // Buscar informações do serviço selecionado para validar horário
    const servicoSelecionado = servicosData?.data?.find(s => s.id === parseInt(selectedServico));
    if (!servicoSelecionado) {
      toast({
        title: "Serviço não encontrado",
        description: "Selecione um serviço válido",
        variant: "destructive",
      });
      return;
    }

    // Validar horário permitido considerando duração do serviço
    const [hour, minute] = selectedHour.split(':').map(Number);
    const duracaoServico = servicoSelecionado.tempoMinutos || 30;
    const totalMinutosInicio = hour * 60 + minute;
    const totalMinutosFim = totalMinutosInicio + duracaoServico;
    const horaFim = Math.floor(totalMinutosFim / 60);
    const minutoFim = totalMinutosFim % 60;
    
    if (hour < 8 || horaFim > 20 || (horaFim === 20 && minutoFim > 0)) {
      toast({
        title: "Horário não permitido",
        description: `Serviço de ${duracaoServico}min iniciando às ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} terminaria às ${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}. Horário permitido: 08:00-20:00`,
        variant: "destructive",
      });
      return;
    }

    // Enviar horário diretamente no formato de Brasília sem conversão UTC
    const dataHora = `${format(selectedDate, "yyyy-MM-dd")} ${selectedHour}:00`;
    
    console.log(`🕐 Criando agendamento:`, {
      dataOriginal: `${format(selectedDate, "yyyy-MM-dd")} ${selectedHour}:00`,
      dataConvertida: dataHora,
      servicoId: selectedServico,
      duracaoServico: duracaoServico,
      horarioTermino: `${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`
    });
    
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
    <div className="h-full bg-background text-foreground flex flex-col lg:flex-row overflow-hidden">
      {/* Área Principal da Agenda - Mobile First */}
      <div className="flex-1 bg-background flex flex-col h-full min-w-0 order-1 lg:order-1">
        {/* Cabeçalho da Agenda - Mobile Responsive */}
        <div className="bg-card border-b border-border px-2 sm:px-3 py-2 sm:py-1.5 shadow-sm flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/recepcionista-dashboard")}
              className="flex items-center gap-1 hover:bg-muted h-7 px-2 self-start"
            >
              <ArrowLeft className="h-3 w-3" />
              <span className="text-xs font-medium">Voltar</span>
            </Button>

            <div className="text-center flex-1 sm:flex-none">
              <h1 className="text-sm sm:text-base font-semibold text-foreground">Agenda do Dia</h1>
              <div className="text-xs text-muted-foreground capitalize">
                <span className="hidden sm:inline">{format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}</span>
                <span className="sm:hidden">{format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="h-7 px-1 sm:px-2"
              >
                <ChevronLeft className="h-3 w-3" />
                <span className="ml-1 text-xs hidden sm:inline">Anterior</span>
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
                className="h-7 px-1 sm:px-2"
              >
                <span className="mr-1 text-xs hidden sm:inline">Próximo</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Grade da Agenda - Mobile Responsive */}
        <div className="bg-card relative flex-1 overflow-y-auto overflow-x-auto">
          {activeBarbeiros.length === 0 ? (
            /* Mensagem quando não há barbeiros */
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 sm:mb-2">
                  Nenhum barbeiro disponível
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre profissionais com o tipo "barbeiro" para visualizar a agenda.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header com nomes dos barbeiros - Mobile Responsive */}
              <div 
                className="grid bg-muted border-b border-border relative z-10 min-w-fit"
                style={{ 
                  gridTemplateColumns: `60px repeat(${activeBarbeiros.length}, minmax(100px, 1fr))` 
                }}
              >
                <div className="p-1 sm:p-2 border-r border-border font-semibold flex items-center gap-1 text-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs hidden sm:inline">Horário</span>
                </div>
                {activeBarbeiros.map((barbeiro: Barbeiro) => (
                  <div key={barbeiro.id} className="p-1 sm:p-2 border-r border-border text-center min-w-[100px] sm:min-w-[130px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-5 w-5 sm:h-6 sm:w-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">
                          {barbeiro.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-semibold text-xs sm:text-sm text-foreground truncate w-full">{barbeiro.nome}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Linhas de horário - Mobile Responsive */}
          {activeBarbeiros.length > 0 && (
            <div className="h-full overflow-y-auto min-w-fit">
              {timeSlots.map((timeSlot) => (
                <div 
                  key={timeSlot} 
                  className="grid border-b border-border h-10 sm:h-12 hover:bg-muted/30 transition-colors group relative min-w-fit"
                  style={{ 
                    gridTemplateColumns: `60px repeat(${activeBarbeiros.length}, minmax(100px, 1fr))` 
                  }}
                >
                  <div className="p-1 sm:p-2 border-r border-border text-xs sm:text-sm font-semibold text-muted-foreground flex items-center justify-center bg-muted/50">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="text-[10px] sm:text-xs">{timeSlot}</span>
                    </div>
                  </div>
                  
                  {activeBarbeiros.map((barbeiro: Barbeiro) => {
                    const slotData = agendamentosByBarbeiro[barbeiro.id]?.[timeSlot];
                    
                    return (
                      <div key={barbeiro.id} className="border-r border-border relative h-10 sm:h-12 p-0.5 min-w-[100px] sm:min-w-[130px] overflow-visible">
                        {slotData ? (
                          // Se é um slot ocupado (não o principal), não renderizar nada - já está coberto pelo card principal
                          slotData.isOccupiedSlot ? (
                            <div className="w-full h-full min-h-[18px] sm:min-h-[22px] bg-transparent pointer-events-none"></div>
                          ) : (
                            // Slot principal - exibir card completo que se estende pelos slots ocupados
                            <div 
                              className={`
                                ${slotData.status === "FINALIZADO" ? "bg-green-500 hover:bg-green-600" : ""}
                                ${slotData.status === "CANCELADO" ? "bg-gray-500 hover:bg-gray-600" : ""}
                                ${slotData.status === "AGENDADO" ? "bg-blue-600 hover:bg-blue-700" : ""}
                                ${selectedAgendamento && selectedAgendamento.id === slotData.id && isComandaOpen ? "bg-amber-500 hover:bg-amber-600" : ""}
                                rounded-md transition-all duration-200 cursor-pointer text-white shadow-sm hover:shadow-md
                                w-full min-h-[18px] sm:min-h-[22px] flex flex-col justify-start px-1 sm:px-1.5 py-0.5 sm:py-1 overflow-visible relative
                              `}
                              style={{
                                height: `${Math.max(18, (slotData.slotsOcupados?.length || 1) * (window.innerWidth < 640 ? 40 : 48))}px`, // 40px mobile, 48px desktop
                                zIndex: 10,
                                position: 'absolute',
                                top: 0,
                                left: '2px',
                                right: '2px'
                              }}
                              onClick={() => abrirComanda(slotData)}
                              onContextMenu={(e) => handleContextMenu(e, slotData)}
                              title={`${slotData.cliente?.nome} - ${slotData.servico?.nome} (${slotData.duracaoMinutos}min)`}
                            >
                              <div className="flex items-start justify-between w-full overflow-hidden">
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <div className="font-medium text-white text-[8px] sm:text-[10px] leading-tight truncate">
                                    {slotData.cliente?.nome}
                                  </div>
                                  <div className="text-white/90 text-[7px] sm:text-[9px] leading-tight truncate mt-0.5 hidden sm:block">
                                    {slotData.servico?.nome}
                                  </div>
                                  <div className="text-white/70 text-[7px] sm:text-[8px] leading-tight mt-0.5 hidden sm:block">
                                    {slotData.duracaoMinutos}min
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-center space-y-1">
                                  {slotData.status === "FINALIZADO" && (
                                    <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-white/90 flex-shrink-0" />
                                  )}
                                  
                                  {slotData.status === "CANCELADO" && (
                                    <X className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-white/90 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )
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

      {/* Sidebar do Calendário - Mobile Responsive */}
      <div className="w-full lg:w-80 bg-card border-t lg:border-t-0 lg:border-l border-border shadow-2xl flex-shrink-0 overflow-y-auto order-2 lg:order-2 max-h-[50vh] lg:max-h-none">
        <div className="p-3 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Calendário
          </h2>
        </div>
        
        {/* Mini Calendário - Mobile Responsive */}
        <div className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={previousMonth} 
              className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-muted"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <h3 className="font-semibold text-sm sm:text-base text-foreground capitalize">
              {format(currentCalendarDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={nextMonth}
              className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-muted"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs mb-2 sm:mb-3">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
              <div key={day} className="p-1 sm:p-2 font-medium text-muted-foreground">
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][index]}</span>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {daysInMonth.map(date => (
              <Button
                key={date.toISOString()}
                variant="ghost"
                size="sm"
                onClick={() => selectCalendarDate(date)}
                className={`
                  h-6 w-6 sm:h-8 sm:w-8 p-0 text-xs transition-all hover:bg-muted relative
                  ${isSameDay(date, selectedDate) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  ${isToday(date) ? 'font-bold ring-1 sm:ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                  ${!isSameMonth(date, currentCalendarDate) ? 'text-muted-foreground/50' : ''}
                `}
              >
                {format(date, "d")}
                {hasAgendamentos(date) && (
                  <div className="absolute bottom-0 right-0 h-1 w-1 sm:h-1.5 sm:w-1.5 bg-green-500 rounded-full"></div>
                )}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Navegação de Data - Mobile Responsive */}
        <div className="p-3 sm:p-6 border-t border-border">
          <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCalendarDate(subDays(selectedDate, 1))}
              className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
            >
              <ChevronLeft className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">Ant</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => selectCalendarDate(new Date())}
              className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCalendarDate(addDays(selectedDate, 1))}
              className="flex-1 text-xs sm:text-sm py-1 sm:py-2"
            >
              <span className="hidden sm:inline">Próximo</span>
              <span className="sm:hidden">Prox</span>
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