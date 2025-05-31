import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Clock, CheckCircle, Calendar } from "lucide-react";
import type { Barbeiro, Servico, Cliente } from "@shared/schema";

interface Agendamento {
  id: number;
  clienteId: number;
  barbeiroId: number;
  servicoId: number;
  dataHora: string;
  status: 'AGENDADO' | 'FINALIZADO';
  cliente: Cliente;
  barbeiro: Barbeiro;
  servico: Servico;
}

interface AgendamentoForm {
  clienteId: number;
  barbeiroId: number;
  servicoId: number;
  dataHora: string;
}

export default function Agendamento() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [formData, setFormData] = useState<AgendamentoForm>({
    clienteId: 0,
    barbeiroId: 0,
    servicoId: 0,
    dataHora: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: barbeiros, isLoading: barbeirosLoading } = useQuery<Barbeiro[]>({
    queryKey: ["/api/barbeiros"],
  });

  const { data: servicos } = useQuery<Servico[]>({
    queryKey: ["/api/servicos"],
  });

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: agendamentos, isLoading: agendamentosLoading } = useQuery<Agendamento[]>({
    queryKey: ["/api/agendamentos", selectedDate],
  });

  const criarAgendamento = useMutation({
    mutationFn: async (data: AgendamentoForm) => {
      return await apiRequest("/api/agendamentos", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Agendamento criado",
        description: "O agendamento foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar agendamento.",
        variant: "destructive",
      });
    },
  });

  const finalizarAtendimento = useMutation({
    mutationFn: async (agendamentoId: number) => {
      return await apiRequest(`/api/agendamentos/${agendamentoId}/finalizar`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agendamentos"] });
      toast({
        title: "Atendimento finalizado",
        description: "O atendimento foi finalizado e contabilizado para comissão.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao finalizar atendimento.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clienteId: 0,
      barbeiroId: 0,
      servicoId: 0,
      dataHora: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clienteId || !formData.barbeiroId || !formData.servicoId || !formData.dataHora) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }
    criarAgendamento.mutate(formData);
  };

  const getAgendamentosPorBarbeiro = (barbeiroId: number) => {
    return agendamentos?.filter(ag => ag.barbeiroId === barbeiroId) || [];
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (barbeirosLoading || agendamentosLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Atendimentos</h1>
          <p className="text-muted-foreground">Gerencie agendamentos e finalize atendimentos</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="trato-button-primary">
                <Plus className="h-4 w-4 mr-2" />
                Agendar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={formData.clienteId.toString()} onValueChange={(value) => setFormData({...formData, clienteId: Number(value)})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id.toString()}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="barbeiro">Barbeiro</Label>
                  <Select value={formData.barbeiroId.toString()} onValueChange={(value) => setFormData({...formData, barbeiroId: Number(value)})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o barbeiro" />
                    </SelectTrigger>
                    <SelectContent>
                      {barbeiros?.map((barbeiro) => (
                        <SelectItem key={barbeiro.id} value={barbeiro.id.toString()}>
                          {barbeiro.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="servico">Serviço</Label>
                  <Select value={formData.servicoId.toString()} onValueChange={(value) => setFormData({...formData, servicoId: Number(value)})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos?.map((servico) => (
                        <SelectItem key={servico.id} value={servico.id.toString()}>
                          {servico.nome} ({servico.tempoMinutos} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dataHora">Data e Hora</Label>
                  <Input
                    type="datetime-local"
                    value={formData.dataHora}
                    onChange={(e) => setFormData({...formData, dataHora: e.target.value})}
                    required
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 trato-button-primary"
                    disabled={criarAgendamento.isPending}
                  >
                    {criarAgendamento.isPending ? "Criando..." : "Agendar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid de Barbeiros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {barbeiros?.map((barbeiro) => {
          const agendamentosDoBarbeiro = getAgendamentosPorBarbeiro(barbeiro.id);
          
          return (
            <Card key={barbeiro.id} className="trato-card">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {barbeiro.nome.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{barbeiro.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {agendamentosDoBarbeiro.length} agendamentos
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {agendamentosDoBarbeiro.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum agendamento hoje</p>
                    </div>
                  ) : (
                    agendamentosDoBarbeiro.map((agendamento) => (
                      <div
                        key={agendamento.id}
                        className={`p-3 rounded-lg border ${
                          agendamento.status === 'FINALIZADO'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {formatTime(agendamento.dataHora)}
                            </span>
                          </div>
                          <Badge 
                            variant={agendamento.status === 'FINALIZADO' ? 'default' : 'secondary'}
                          >
                            {agendamento.status === 'FINALIZADO' ? 'Finalizado' : 'Agendado'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground">
                            {agendamento.cliente.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {agendamento.servico.nome} • {agendamento.servico.tempoMinutos} min
                          </p>
                        </div>
                        
                        {agendamento.status === 'AGENDADO' && (
                          <Button
                            size="sm"
                            className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => finalizarAtendimento.mutate(agendamento.id)}
                            disabled={finalizarAtendimento.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Finalizar Atendimento
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}