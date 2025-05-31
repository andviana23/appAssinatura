import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedBarbeiro, setSelectedBarbeiro] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, "yyyy-MM-dd");

  // Queries
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["/api/agendamentos", dateString],
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

  // Mutations
  const createAgendamento = useMutation({
    mutationFn: (data: any) => apiRequest("/api/agendamentos", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      setIsModalOpen(false);
      toast({ title: "Agendamento criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar agendamento", variant: "destructive" });
    },
  });

  const finalizarAtendimento = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/agendamentos/${id}/finalizar`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      toast({ title: "Atendimento finalizado com sucesso!" });
    },
    onError: () => {
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

  const handleCreateAgendamento = (formData: FormData) => {
    const clienteId = formData.get("clienteId");
    const servicoId = formData.get("servicoId");
    
    if (!clienteId || !servicoId || !selectedHour || !selectedBarbeiro) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const dataHora = new Date(selectedDate);
    const [hour, minute] = selectedHour.split(":");
    dataHora.setHours(parseInt(hour), parseInt(minute), 0, 0);

    createAgendamento.mutate({
      clienteId: parseInt(clienteId as string),
      barbeiroId: parseInt(selectedBarbeiro),
      servicoId: parseInt(servicoId as string),
      dataHora: dataHora.toISOString(),
    });
  };

  const getAgendamentoEndTime = (agendamento: Agendamento) => {
    const startTime = new Date(agendamento.dataHora);
    const endTime = new Date(startTime.getTime() + (agendamento.servico?.tempoMinutos || 30) * 60000);
    return format(endTime, "HH:mm");
  };

  return (
    <div className="flex gap-6 p-6">
      {/* Agenda Principal */}
      <div className="flex-1">
        {/* Header com navegação de data */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#8B4513]">Agendamento</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className={isToday(selectedDate) ? "bg-[#8B4513] hover:bg-[#A0522D]" : ""}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="text-lg font-semibold text-[#8B4513]">
            {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>

        {/* Grade da Agenda */}
        <div className="border rounded-lg bg-white overflow-hidden">
          {/* Header com nomes dos barbeiros */}
          <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(150px,1fr))] bg-[#8B4513] text-white">
            <div className="p-3 border-r border-[#A0522D] font-semibold">Horário</div>
            {activeBarbeiros.map((barbeiro: Barbeiro) => (
              <div key={barbeiro.id} className="p-3 border-r border-[#A0522D] text-center font-semibold">
                {barbeiro.nome}
              </div>
            ))}
          </div>

          {/* Linhas de horário */}
          <div className="max-h-[600px] overflow-y-auto">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className="grid grid-cols-[80px_repeat(auto-fit,minmax(150px,1fr))] border-b border-gray-200 min-h-[50px]">
                <div className="p-2 border-r border-gray-200 text-sm font-medium text-gray-600 flex items-center">
                  {timeSlot}
                </div>
                
                {activeBarbeiros.map((barbeiro: Barbeiro) => {
                  const agendamento = agendamentosByBarbeiro[barbeiro.id]?.[timeSlot];
                  
                  return (
                    <div key={barbeiro.id} className="border-r border-gray-200 p-1 relative">
                      {agendamento ? (
                        <div className="bg-[#90EE90] border border-[#32CD32] rounded p-2 text-xs h-full">
                          <div className="font-semibold text-[#006400]">
                            {timeSlot} – {getAgendamentoEndTime(agendamento)}
                          </div>
                          <div className="text-[#006400] font-medium">
                            {agendamento.cliente?.nome}
                          </div>
                          <div className="text-[#006400]">
                            {agendamento.servico?.nome} ({agendamento.servico?.tempoMinutos}min)
                          </div>
                          
                          {agendamento.status !== "FINALIZADO" && (
                            <Button
                              size="sm"
                              className="mt-1 h-6 px-2 bg-[#8B4513] hover:bg-[#A0522D] text-white"
                              onClick={() => finalizarAtendimento.mutate(agendamento.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Finalizar
                            </Button>
                          )}
                          
                          {agendamento.status === "FINALIZADO" && (
                            <div className="mt-1 text-[#006400] font-semibold text-xs">
                              ✓ FINALIZADO
                            </div>
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
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleCreateAgendamento(formData);
          }} className="space-y-4">
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
              <Select name="clienteId" required>
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
              <Select name="servicoId" required>
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
                type="submit"
                className="flex-1 bg-[#8B4513] hover:bg-[#A0522D]"
                disabled={createAgendamento.isPending}
              >
                {createAgendamento.isPending ? "Criando..." : "Agendar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Calendário Lateral */}
      <div className="w-80">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#365e78] flex items-center">
              <CalendarDays className="h-5 w-5 mr-2" />
              Calendário
            </h3>
          </div>

          <div className="text-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
            </h4>
          </div>

          {/* Data selecionada */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">Data selecionada:</p>
            <p className="text-lg font-semibold text-[#365e78]">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <p className="text-xs text-gray-500">
              {format(selectedDate, "EEEE", { locale: ptBR })}
            </p>
          </div>

          {/* Legenda */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <div className="h-2 w-2 rounded-full bg-[#365e78]"></div>
              <span>Dias com agendamentos</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Hoje</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}