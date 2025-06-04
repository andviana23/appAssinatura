import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, DollarSign, Users, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function GerenciarAssinaturas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    valor: "",
    categoria: ""
  });

  // Buscar planos existentes com cache otimizado
  const { data: planos, isLoading } = useQuery({
    queryKey: ["/api/planos-assinatura"],
    queryFn: async () => {
      const response = await apiRequest("/api/planos-assinatura");
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos antes de considerar stale
    cacheTime: 10 * 60 * 1000 // 10 minutos no cache
  });

  // Criar nova assinatura e gerar paymentLink automaticamente
  const criarAssinatura = useMutation({
    mutationFn: async (dados) => {
      const response = await apiRequest("/api/assinatura/criar-plano", "POST", {
        nome: dados.nome,
        descricao: dados.descricao || `Assinatura ${dados.nome} - Renovação mensal automática`,
        valorMensal: dados.valor || dados.valorMensal,
        categoria: dados.categoria,
        servicosIncluidos: dados.servicosIncluidos || []
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Plano criado com sucesso!", 
        description: `PaymentLink gerado: ${data.checkoutUrl}` 
      });
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/planos-assinatura"] });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao criar assinatura", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Atualizar assinatura
  const atualizarAssinatura = useMutation({
    mutationFn: async (dados) => {
      const response = await apiRequest(`/api/planos-assinatura/${editingPlano.id}`, "PUT", dados);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Assinatura atualizada com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/planos-assinatura"] });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao atualizar assinatura", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Excluir assinatura
  const excluirAssinatura = useMutation({
    mutationFn: async (id) => {
      const response = await apiRequest(`/api/planos-assinatura/${id}`, "DELETE");
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Assinatura excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/planos-assinatura"] });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao excluir assinatura", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      valor: "",
      categoria: ""
    });
    setEditingPlano(null);
  };

  const handleSubmit = () => {
    if (!formData.nome || !formData.valor || !formData.categoria) {
      toast({ 
        title: "Campos obrigatórios", 
        description: "Preencha nome, valor e categoria",
        variant: "destructive" 
      });
      return;
    }

    const dados = {
      nome: formData.nome,
      valorMensal: parseFloat(formData.valor),
      categoria: formData.categoria,
      descricao: `Assinatura ${formData.nome} - ${formData.categoria}`
    };

    if (editingPlano) {
      atualizarAssinatura.mutate(dados);
    } else {
      criarAssinatura.mutate(dados);
    }
  };

  const handleEdit = (plano: any) => {
    setEditingPlano(plano);
    setFormData({
      nome: plano.nome,
      valor: plano.valorMensal?.toString() || plano.valor?.toString() || "",
      categoria: plano.categoria
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta assinatura?")) {
      excluirAssinatura.mutate(id);
    }
  };

  const handleGerarLinkExclusivo = async (plano: any) => {
    try {
      const response = await apiRequest(`/api/planos-assinatura/${plano.id}/gerar-link-exclusivo`, "POST");
      const data = await response.json();
      
      if (data.checkoutUrl) {
        // Copiar link para área de transferência
        await navigator.clipboard.writeText(data.checkoutUrl);
        toast({ 
          title: "Link gerado com sucesso!", 
          description: "Link copiado para área de transferência. Válido apenas para clientes com assinatura ativa." 
        });
      }
    } catch (error) {
      toast({ 
        title: "Erro ao gerar link", 
        description: "Verifique se há clientes ativos no sistema",
        variant: "destructive" 
      });
    }
  };

  const categorias = [
    "⭐One",
    "👑Gold", 
    "🚀Multi",
    "Exclusivo"
  ];

  const getBadgeColor = (categoria: string) => {
    const colors = {
      "⭐One": "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200",
      "👑Gold": "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200", 
      "🚀Multi": "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200",
      "Exclusivo": "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
    };
    return colors[categoria] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-start lg:items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-all duration-200 hover:scale-105 bg-card dark:bg-card rounded-xl px-4 py-2 shadow-lg hover:shadow-xl border border-border"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Gerenciar Assinaturas
                </h1>
                <p className="text-muted-foreground mt-1">Configure planos e categorias</p>
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card dark:bg-card text-foreground border border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingPlano ? "Editar Assinatura" : "Nova Assinatura"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Configure os detalhes da assinatura e ela será criada no sistema
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-foreground">Nome da Assinatura *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Clube do Trato Premium"
                    className="bg-background border-border text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria" className="text-foreground">Categoria *</Label>
                  <Select value={formData.categoria} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-foreground hover:bg-muted">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor" className="text-foreground">Valor Mensal (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({...formData, valor: e.target.value})}
                    placeholder="0.00"
                    className="bg-background border-border text-foreground"
                  />
                </div>


              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border text-foreground hover:bg-muted">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={criarAssinatura.isPending || atualizarAssinatura.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {criarAssinatura.isPending || atualizarAssinatura.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Assinaturas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando assinaturas...</p>
            </div>
          ) : planos?.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma assinatura criada</h3>
              <p className="text-muted-foreground mb-6">Comece criando sua primeira assinatura</p>
            </div>
          ) : (
            planos?.map((plano) => (
              <Card key={plano.id} className="bg-card dark:bg-card border border-border shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-foreground mb-2">
                        {plano.nome}
                      </CardTitle>
                      <Badge className={`${getBadgeColor(plano.categoria)} border-0`}>
                        {plano.categoria}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        R$ {typeof plano.valorMensal === 'number' ? plano.valorMensal.toFixed(2) : parseFloat(plano.valorMensal || '0').toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">por mês</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {plano.descricao && (
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                      {plano.descricao}
                    </p>
                  )}
                  
                  {plano.beneficios && plano.beneficios.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-foreground mb-2">Benefícios:</h4>
                      <ul className="space-y-1">
                        {plano.beneficios.slice(0, 3).map((beneficio, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                            {beneficio}
                          </li>
                        ))}
                        {plano.beneficios.length > 3 && (
                          <li className="text-sm text-muted-foreground/70">
                            +{plano.beneficios.length - 3} mais benefícios
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(plano)}
                      className="flex-1 border-border text-foreground hover:bg-muted"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    {plano.categoria === "Exclusiva clientes antigo" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGerarLinkExclusivo(plano)}
                        className="flex-1 bg-secondary dark:bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        Gerar Link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(plano.id)}
                      disabled={excluirAssinatura.isPending}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}