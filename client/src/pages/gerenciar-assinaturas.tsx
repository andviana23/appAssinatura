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
    descricao: "",
    valor: "",
    categoria: "",
    billingType: "CREDIT_CARD",
    cycle: "MONTHLY",
    limitesServicos: "",
    beneficios: ""
  });

  // Buscar planos existentes
  const { data: planos, isLoading } = useQuery({
    queryKey: ["/api/planos-assinatura"],
    queryFn: async () => {
      const response = await apiRequest("/api/planos-assinatura");
      return await response.json();
    }
  });

  // Criar nova assinatura
  const criarAssinatura = useMutation({
    mutationFn: async (dados) => {
      const response = await apiRequest("/api/planos-assinatura", "POST", dados);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Assinatura criada com sucesso!" });
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
      descricao: "",
      valor: "",
      categoria: "",
      billingType: "CREDIT_CARD",
      cycle: "MONTHLY",
      limitesServicos: "",
      beneficios: ""
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
      ...formData,
      valor: parseFloat(formData.valor),
      limitesServicos: formData.limitesServicos ? JSON.parse(formData.limitesServicos) : {},
      beneficios: formData.beneficios.split(',').map(b => b.trim()).filter(b => b)
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
      descricao: plano.descricao || "",
      valor: plano.valor.toString(),
      categoria: plano.categoria,
      billingType: plano.billingType || "CREDIT_CARD",
      cycle: plano.cycle || "MONTHLY",
      limitesServicos: JSON.stringify(plano.limitesServicos || {}),
      beneficios: plano.beneficios ? plano.beneficios.join(', ') : ""
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
    "Exclusiva clientes antigo"
  ];

  const getBadgeColor = (categoria: string) => {
    const colors = {
      "⭐One": "bg-blue-100 text-blue-800",
      "👑Gold": "bg-yellow-100 text-yellow-800", 
      "🚀Multi": "bg-purple-100 text-purple-800",
      "Exclusiva clientes antigo": "bg-green-100 text-green-800"
    };
    return colors[categoria] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-start lg:items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                  Gerenciar Assinaturas
                </h1>
                <p className="text-gray-600 mt-1">Configure planos e categorias</p>
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPlano ? "Editar Assinatura" : "Nova Assinatura"}
                </DialogTitle>
                <DialogDescription>
                  Configure os detalhes da assinatura e ela será criada no sistema
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Assinatura *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Clube do Trato Premium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select value={formData.categoria} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor">Valor Mensal (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({...formData, valor: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingType">Forma de Pagamento</Label>
                  <Select value={formData.billingType} onValueChange={(value) => setFormData({...formData, billingType: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Descreva os benefícios e detalhes da assinatura..."
                    rows={3}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="beneficios">Benefícios (separados por vírgula)</Label>
                  <Input
                    id="beneficios"
                    value={formData.beneficios}
                    onChange={(e) => setFormData({...formData, beneficios: e.target.value})}
                    placeholder="Ex: Cortes ilimitados, Desconto em produtos, Atendimento prioritário"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={criarAssinatura.isPending || atualizarAssinatura.isPending}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#365e78] mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando assinaturas...</p>
            </div>
          ) : planos?.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma assinatura criada</h3>
              <p className="text-gray-600 mb-6">Comece criando sua primeira assinatura</p>
            </div>
          ) : (
            planos?.map((plano) => (
              <Card key={plano.id} className="bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-gray-900 mb-2">
                        {plano.nome}
                      </CardTitle>
                      <Badge className={`${getBadgeColor(plano.categoria)} border-0`}>
                        {plano.categoria}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#365e78]">
                        R$ {plano.valor.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">por mês</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {plano.descricao && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {plano.descricao}
                    </p>
                  )}
                  
                  {plano.beneficios && plano.beneficios.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-gray-900 mb-2">Benefícios:</h4>
                      <ul className="space-y-1">
                        {plano.beneficios.slice(0, 3).map((beneficio, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-center">
                            <div className="w-1.5 h-1.5 bg-[#365e78] rounded-full mr-2"></div>
                            {beneficio}
                          </li>
                        ))}
                        {plano.beneficios.length > 3 && (
                          <li className="text-sm text-gray-500">
                            +{plano.beneficios.length - 3} mais benefícios
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(plano)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    {plano.categoria === "Exclusiva clientes antigo" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGerarLinkExclusivo(plano)}
                        className="flex-1"
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