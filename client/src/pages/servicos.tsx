import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Edit, Trash2, Clock, Scissors } from "lucide-react";
import type { Servico } from "@shared/schema";

interface ServicoFormData {
  nome: string;
  tempoMinutos: number;
  percentualComissao: number;
}

export default function Servicos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [formData, setFormData] = useState<ServicoFormData>({
    nome: "",
    tempoMinutos: 30,
    percentualComissao: 40,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servicos, isLoading } = useQuery<Servico[]>({
    queryKey: ["/api/servicos"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ServicoFormData) =>
      apiRequest("POST", "/api/servicos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Serviço criado",
        description: "Serviço criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar serviço",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServicoFormData> }) =>
      apiRequest("PUT", `/api/servicos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Serviço atualizado",
        description: "Serviço atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar serviço",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/servicos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos"] });
      toast({
        title: "Serviço removido",
        description: "Serviço removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover serviço",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", tempoMinutos: 30, isAssinatura: false });
    setEditingServico(null);
  };

  const openDialog = (servico?: Servico) => {
    if (servico) {
      setEditingServico(servico);
      setFormData({
        nome: servico.nome,
        tempoMinutos: servico.tempoMinutos,
        isAssinatura: servico.isAssinatura,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingServico) {
      updateMutation.mutate({ id: editingServico.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este serviço?")) {
      deleteMutation.mutate(id);
    }
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
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
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
          <h2 className="text-2xl font-bold text-foreground">Gestão de Serviços</h2>
          <p className="text-muted-foreground">Configure os serviços oferecidos pela barbearia</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingServico ? "Editar Serviço" : "Novo Serviço"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Serviço</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Corte Masculino"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="tempoMinutos">Tempo Padrão (minutos)</Label>
                <Input
                  id="tempoMinutos"
                  type="number"
                  min="5"
                  max="300"
                  value={formData.tempoMinutos}
                  onChange={(e) => setFormData({ ...formData, tempoMinutos: parseInt(e.target.value) })}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAssinatura"
                  checked={formData.isAssinatura}
                  onChange={(e) => setFormData({ ...formData, isAssinatura: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
                <Label htmlFor="isAssinatura">Serviço de assinatura</Label>
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
                  {editingServico ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Serviços</CardTitle>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos?.map((servico) => (
                <TableRow key={servico.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                        <Scissors className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{servico.nome}</div>
                        <div className="text-sm text-muted-foreground">ID: #{servico.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{servico.tempoMinutos} min</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={servico.isAssinatura ? "default" : "secondary"}>
                      {servico.isAssinatura ? "Assinatura" : "Avulso"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDialog(servico)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(servico.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {servicos?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum serviço cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
