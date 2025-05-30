import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Barbeiro, Servico } from "@shared/schema";

interface AtendimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  barbeiro: Barbeiro;
  mes: string;
}

interface AtendimentoItem {
  servicoId: number;
  data: Date;
  quantidade: number;
}

export function AtendimentoModal({ isOpen, onClose, barbeiro, mes }: AtendimentoModalProps) {
  const [atendimentos, setAtendimentos] = useState<AtendimentoItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servicosAssinatura = [] } = useQuery({
    queryKey: ['/api/servicos/assinatura'],
    enabled: isOpen,
  });

  const createAtendimentoMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/atendimentos', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atendimentos'] });
      toast({
        title: "Sucesso",
        description: "Atendimentos registrados com sucesso!",
      });
      setAtendimentos([]);
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao registrar atendimentos",
        variant: "destructive",
      });
    },
  });

  const adicionarAtendimento = () => {
    setAtendimentos([...atendimentos, {
      servicoId: 0,
      data: new Date(),
      quantidade: 1
    }]);
  };

  const removerAtendimento = (index: number) => {
    setAtendimentos(atendimentos.filter((_, i) => i !== index));
  };

  const atualizarAtendimento = (index: number, campo: keyof AtendimentoItem, valor: any) => {
    const novosAtendimentos = [...atendimentos];
    novosAtendimentos[index] = { ...novosAtendimentos[index], [campo]: valor };
    setAtendimentos(novosAtendimentos);
  };

  const salvarAtendimentos = async () => {
    if (atendimentos.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um atendimento",
        variant: "destructive",
      });
      return;
    }

    for (const atendimento of atendimentos) {
      if (!atendimento.servicoId || atendimento.quantidade <= 0) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos corretamente",
          variant: "destructive",
        });
        return;
      }

      const atendimentoData = {
        barbeiroId: barbeiro.id,
        servicoId: atendimento.servicoId,
        dataAtendimento: atendimento.data.toISOString(),
        quantidade: atendimento.quantidade,
        mes: mes,
      };

      await createAtendimentoMutation.mutateAsync(atendimentoData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Registrar Atendimentos - {barbeiro.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Atendimentos do Mês: {mes}</h3>
            <Button onClick={adicionarAtendimento} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {atendimentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum atendimento adicionado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div className="space-y-4">
              {atendimentos.map((atendimento, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Atendimento {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removerAtendimento(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Serviço</Label>
                      <Select
                        value={atendimento.servicoId.toString()}
                        onValueChange={(value) => atualizarAtendimento(index, 'servicoId', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {(servicosAssinatura as Servico[]).map((servico) => (
                            <SelectItem key={servico.id} value={servico.id.toString()}>
                              {servico.nome} ({servico.tempoMinutos}min)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Data do Atendimento</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(atendimento.data, "dd/MM/yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={atendimento.data}
                            onSelect={(date) => date && atualizarAtendimento(index, 'data', date)}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        value={atendimento.quantidade}
                        onChange={(e) => atualizarAtendimento(index, 'quantidade', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={salvarAtendimentos}
              disabled={createAtendimentoMutation.isPending || atendimentos.length === 0}
            >
              {createAtendimentoMutation.isPending ? "Salvando..." : "Salvar Atendimentos"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}