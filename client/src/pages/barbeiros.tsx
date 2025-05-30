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
import { getInitials } from "@/lib/utils";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import type { Barbeiro } from "@shared/schema";

interface BarbeiroFormData {
  nome: string;
  email: string;
  ativo: boolean;
}

export default function Barbeiros() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBarbeiro, setEditingBarbeiro] = useState<Barbeiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<BarbeiroFormData>({
    nome: "",
    email: "",
    ativo: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: barbeiros, isLoading } = useQuery<Barbeiro[]>({
    queryKey: ["/api/barbeiros"],
  });

  const createMutation = useMutation({
    mutationFn: (data: BarbeiroFormData) =>
      apiRequest("POST", "/api/barbeiros", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Barbeiro criado",
        description: "Barbeiro criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar barbeiro",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BarbeiroFormData> }) =>
      apiRequest("PUT", `/api/barbeiros/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Barbeiro atualizado",
        description: "Barbeiro atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar barbeiro",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/barbeiros/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      toast({
        title: "Barbeiro removido",
        description: "Barbeiro removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover barbeiro",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", email: "", ativo: true });
    setEditingBarbeiro(null);
  };

  const openDialog = (barbeiro?: Barbeiro) => {
    if (barbeiro) {
      setEditingBarbeiro(barbeiro);
      setFormData({
        nome: barbeiro.nome,
        email: barbeiro.email,
        ativo: barbeiro.ativo,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingBarbeiro) {
      updateMutation.mutate({ id: editingBarbeiro.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este barbeiro?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredBarbeiros = barbeiros?.filter((barbeiro) =>
    barbeiro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    barbeiro.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
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
          <h2 className="text-2xl font-bold text-foreground">Gestão de Barbeiros</h2>
          <p className="text-muted-foreground">Cadastre e gerencie os barbeiros da sua equipe</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Barbeiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBarbeiro ? "Editar Barbeiro" : "Novo Barbeiro"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Digite o nome do barbeiro"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="barbeiro@tratodebarbados.com"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
                <Label htmlFor="ativo">Barbeiro ativo</Label>
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
                  {editingBarbeiro ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Barbeiros</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar barbeiro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbeiro</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBarbeiros.map((barbeiro) => (
                <TableRow key={barbeiro.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {getInitials(barbeiro.nome)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{barbeiro.nome}</div>
                        <div className="text-sm text-muted-foreground">ID: #{barbeiro.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{barbeiro.email}</TableCell>
                  <TableCell>
                    <Badge variant={barbeiro.ativo ? "default" : "secondary"}>
                      {barbeiro.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDialog(barbeiro)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(barbeiro.id)}
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
          
          {filteredBarbeiros.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum barbeiro encontrado" : "Nenhum barbeiro cadastrado"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
