import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { Plus, Edit, Trash2, CreditCard } from "lucide-react";
import type { PlanoAssinatura, Servico } from "@shared/schema";

interface PlanoFormData {
  nome: string;
  valorMensal: string;
  descricao: string;
  servicosIncluidos: number[];
}

export default function Planos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoAssinatura | null>(null);
  const [formData, setFormData] = useState<PlanoFormData>({
    nome: "",
    valorMensal: "",
    descricao: "",
    servicosIncluidos: [],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: planos, isLoading } = useQuery<PlanoAssinatura[]>({
    queryKey: ["/api/planos"],
  });

  const { data: servicos } = useQuery<Servico[]>({
    queryKey: ["/api/servicos"],
  });

  const createMutation = useMutation({
    mutationFn: (data: PlanoFormData) => {
      const payload = {
        ...data,
        valorMensal: parseFloat(data.valorMensal),
      };
      return apiRequest("POST", "/api/planos", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Plano criado",
        description: "Plano de assinatura criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar plano de assinatura",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanoFormData> }) => {
      const payload = {
        ...data,
        valorMensal: data.valorMensal ? parseFloat(data.valorMensal) : undefined,
      };
      return apiRequest("PUT", `/api/planos/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Plano atualizado",
        description: "Plano de assinatura atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar plano de assinatura",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/planos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planos"] });
      toast({
        title: "Plano removido",
        description: "Plano de assinatura removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover plano de assinatura",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", valorMensal: "", descricao: "", servicosIncluidos: [] });
    setEditingPlano(null);
  };

  const openDialog = (plano?: PlanoAssinatura) => {
    if (plano) {
      setEditingPlano(plano);
      setFormData({
        nome: plano.nome,
        valorMensal: plano.valorMensal,
        descricao: plano.descricao || "",
        servicosIncluidos: plano.servicosIncluidos || [],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingPlano) {
      updateMutation.mutate({ id: editingPlano.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este plano?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleServicoToggle = (servicoId: number) => {
    setFormData(prev => ({
      ...prev,
      servicosIncluidos: prev.servicosIncluidos.includes(servicoId)
        ? prev.servicosIncluidos.filter(id => id !== servicoId)
        : [...prev.servicosIncluidos, servicoId]
    }));
  };

  const getServicosNames = (servicosIds: number[]) => {
    if (!servicos) return [];
    return servicosIds
      .map(id => servicos.find(s => s.id === id)?.nome)
      .filter(Boolean) as string[];
  };

  if (isLoading) {
    return (
      <div className="space-y-24">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Planos de Assinatura</h2>
          <p className="text-muted-foreground">Gerencie os planos oferecidos aos clientes</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlano ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Plano</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Plano Premium"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="valorMensal">Valor Mensal (R$)</Label>
                  <Input
                    id="valorMensal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valorMensal}
                    onChange={(e) => setFormData({ ...formData, valorMensal: e.target.value })}
                    placeholder="99.90"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva os benefícios do plano..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label>Serviços Incluídos</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-2xl p-4">
                  {servicos?.map((servico) => (
                    <div key={servico.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`servico-${servico.id}`}
                        checked={formData.servicosIncluidos.includes(servico.id)}
                        onCheckedChange={() => handleServicoToggle(servico.id)}
                      />
                      <Label htmlFor={`servico-${servico.id}`} className="text-sm">
                        {servico.nome} ({servico.tempoMinutos} min)
                      </Label>
                    </div>
                  ))}
                </div>
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
                  className="flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPlano ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
        {planos?.map((plano) => (
          <Card key={plano.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-barbershop-gold rounded-full flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">{plano.nome}</CardTitle>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDialog(plano)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(plano.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(parseFloat(plano.valorMensal))}
                  </div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                </div>
                
                {plano.descricao && (
                  <p className="text-sm text-muted-foreground">{plano.descricao}</p>
                )}
                
                <div>
                  <h4 className="font-medium text-foreground mb-2">Serviços Incluídos:</h4>
                  <ul className="space-y-1">
                    {getServicosNames(plano.servicosIncluidos || []).map((servicoNome, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-center">
                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                        {servicoNome}
                      </li>
                    ))}
                  </ul>
                  
                  {(!plano.servicosIncluidos || plano.servicosIncluidos.length === 0) && (
                    <p className="text-sm text-muted-foreground">Nenhum serviço incluído</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {planos?.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Nenhum plano de assinatura cadastrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
