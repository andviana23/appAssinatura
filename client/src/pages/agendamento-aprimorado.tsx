import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, User, Phone, Mail, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getInitials } from "@/lib/utils";

const agendamentoSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  barbeiroId: z.string().min(1, "Barbeiro é obrigatório"),
  servicoId: z.string().min(1, "Serviço é obrigatório"),
  dataHorario: z.string().min(1, "Data e horário são obrigatórios"),
  observacoes: z.string().optional(),
});

type AgendamentoFormData = z.infer<typeof agendamentoSchema>;

export default function AgendamentoAprimorado() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AgendamentoFormData>({
    resolver: zodResolver(agendamentoSchema),
    defaultValues: {
      clienteId: "",
      barbeiroId: "",
      servicoId: "",
      dataHorario: "",
      observacoes: "",
    },
  });

  // Queries
  const { data: clientes, isLoading: clientesLoading } = useQuery({
    queryKey: ["/api/clientes/unified"],
  });

  const { data: barbeiros, isLoading: barbeirosLoading } = useQuery({
    queryKey: ["/api/barbeiros"],
  });

  const { data: servicos, isLoading: servicosLoading } = useQuery({
    queryKey: ["/api/servicos"],
  });

  const { data: agendamentos, isLoading: agendamentosLoading } = useQuery({
    queryKey: ["/api/agendamentos"],
  });

  // Mutation para criar agendamento
  const createAgendamento = useMutation({
    mutationFn: async (data: AgendamentoFormData) => {
      const response = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          barbeiroId: parseInt(data.barbeiroId),
          servicoId: parseInt(data.servicoId),
        }),
      });
      if (!response.ok) throw new Error("Erro ao criar agendamento");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      form.reset();
      setSelectedDate(null);
      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar agendamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AgendamentoFormData) => {
    createAgendamento.mutate(data);
  };

  // Funções do calendário
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Verificar se uma data tem agendamentos
  const hasAgendamentos = (date: Date) => {
    if (!Array.isArray(agendamentos)) return false;
    return agendamentos.some(agendamento => 
      isSameDay(new Date(agendamento.dataHorario), date)
    );
  };

  // Selecionar data no calendário
  const selectDate = (date: Date) => {
    setSelectedDate(date);
    const dateTimeString = format(date, "yyyy-MM-dd'T'09:00");
    form.setValue("dataHorario", dateTimeString);
  };

  if (clientesLoading || barbeirosLoading || servicosLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Agendamentos</h1>
        <p className="text-gray-600">
          Gerencie os agendamentos da barbearia com calendário integrado
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Agendamento */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-[#8B4513] flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Novo Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Cliente */}
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Cliente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(clientes) && clientes.map((cliente) => (
                              <SelectItem key={cliente.id} value={cliente.id.toString()}>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8B4513] text-white text-sm font-semibold">
                                    {getInitials(cliente.nome)}
                                  </div>
                                  <div>
                                    <div className="font-medium">{cliente.nome}</div>
                                    <div className="text-sm text-gray-500">{cliente.email}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Barbeiro */}
                  <FormField
                    control={form.control}
                    name="barbeiroId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Barbeiro</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Selecione um barbeiro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(barbeiros) && barbeiros.map((barbeiro) => (
                              <SelectItem key={barbeiro.id} value={barbeiro.id.toString()}>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8B4513] text-white text-sm font-semibold">
                                    {getInitials(barbeiro.nome)}
                                  </div>
                                  <div>
                                    <div className="font-medium">{barbeiro.nome}</div>
                                    <div className="text-sm text-gray-500">{barbeiro.email}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Serviço */}
                  <FormField
                    control={form.control}
                    name="servicoId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Serviço</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Selecione um serviço" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(servicos) && servicos.map((servico) => (
                              <SelectItem key={servico.id} value={servico.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium">{servico.nome}</span>
                                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <Clock className="h-4 w-4" />
                                    <span>{servico.tempoMinutos}min</span>
                                    <span>R$ {servico.preco}</span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Data e Horário */}
                  <FormField
                    control={form.control}
                    name="dataHorario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Data e Horário</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        {selectedDate && (
                          <p className="text-sm text-[#8B4513]">
                            Data selecionada: {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  {/* Observações */}
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Observações sobre o agendamento (opcional)"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#8B4513] hover:bg-[#A0522D] text-white font-semibold"
                    disabled={createAgendamento.isPending}
                  >
                    {createAgendamento.isPending ? "Criando..." : "Criar Agendamento"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Calendário Lateral */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#8B4513] flex items-center justify-between">
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2" />
                  Calendário
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </h3>
              </div>

              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1">
                {daysInMonth.map((day) => {
                  const hasEvents = hasAgendamentos(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => selectDate(day)}
                      className={`
                        relative h-10 w-10 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105
                        ${isSelected 
                          ? 'bg-[#8B4513] text-white shadow-lg' 
                          : isTodayDate
                          ? 'bg-blue-100 text-blue-700 font-bold'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      {format(day, "d")}
                      {hasEvents && (
                        <div className={`
                          absolute bottom-1 right-1 h-2 w-2 rounded-full
                          ${isSelected ? 'bg-white' : 'bg-[#8B4513]'}
                        `} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-[#8B4513]"></div>
                  <span>Dias com agendamentos</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>Hoje</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agendamentos do dia selecionado */}
          {selectedDate && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#8B4513]">
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agendamentosLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : Array.isArray(agendamentos) ? (
                  <div className="space-y-3">
                    {agendamentos
                      .filter(agendamento => 
                        isSameDay(new Date(agendamento.dataHorario), selectedDate)
                      )
                      .map((agendamento) => (
                      <div
                        key={agendamento.id}
                        className="p-3 rounded-lg bg-gradient-to-r from-[#8B4513]/5 to-[#8B4513]/10 border border-[#8B4513]/20"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#8B4513] text-white text-sm font-semibold">
                              {getInitials(agendamento.cliente?.nome || "?")}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {agendamento.cliente?.nome || "Cliente não encontrado"}
                              </div>
                              <div className="text-sm text-gray-600">
                                {agendamento.servico?.nome || "Serviço não encontrado"}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-[#8B4513]/10 text-[#8B4513]">
                            {format(new Date(agendamento.dataHorario), "HH:mm")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {agendamentos.filter(agendamento => 
                      isSameDay(new Date(agendamento.dataHorario), selectedDate)
                    ).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarDays className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="font-medium">Nenhum agendamento</p>
                        <p className="text-sm">Este dia está livre para novos agendamentos</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Erro ao carregar agendamentos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}