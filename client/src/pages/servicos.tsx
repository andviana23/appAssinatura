import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Clock, Scissors, ArrowLeft, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Servico } from "@shared/schema";

interface ServicoFormData {
  nome: string;
  tempoMinutos: number;
}

export default function Servicos() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ServicoFormData>({
    nome: "",
    tempoMinutos: 30,
  });

  const [nomeError, setNomeError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [servicoParaReativar, setServicoParaReativar] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servicosData, isLoading } = useQuery<any>({
    queryKey: ["/api/servicos", { status: filtroStatus === 'todos' ? undefined : filtroStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') {
        params.append('status', filtroStatus);
      }
      const response = await fetch(`/api/servicos?${params}`);
      return response.json();
    }
  });

  const servicos = servicosData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: ServicoFormData) => {
      const response = await fetch("/api/servicos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: data.nome,
          tempoMinutos: data.tempoMinutos,
          percentualComissao: 40, // Valor padrão
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Lançar erro com mensagem específica do backend
        throw new Error(result.message || "Erro ao cadastrar serviço");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Serviço cadastrado com sucesso!",
        description: "O novo serviço foi adicionado à lista.",
      });
    },
    onError: async (error: Error, variables, context) => {
      try {
        const errorResponse = await fetch("/api/servicos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: variables.nome,
            tempoMinutos: variables.tempoMinutos,
            percentualComissao: 40,
          }),
        });
        
        if (!errorResponse.ok) {
          const errorData = await errorResponse.json();
          
          // Verificar se é um serviço inativo que pode ser reativado
          if (errorResponse.status === 409 && errorData.servicoStatus === 'inativo') {
            setServicoParaReativar(errorData.servicoExistente);
            toast({
              title: "Serviço inativo encontrado",
              description: errorData.message,
              variant: "default",
            });
            return;
          }
          
          toast({
            title: "Erro ao cadastrar serviço",
            description: errorData.message || "Tente novamente em alguns instantes.",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Erro ao cadastrar serviço",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation para reativar serviços inativos
  const reativarMutation = useMutation({
    mutationFn: async (servicoId: number) => {
      const response = await fetch(`/api/servicos/${servicoId}/reativar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao reativar serviço");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servicos"] });
      setServicoParaReativar(null);
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Serviço reativado com sucesso!",
        description: "O serviço foi reativado e está disponível novamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reativar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o nome do serviço.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({ nome: "", tempoMinutos: 30 });
    setNomeError(null);
  };

  // Validação em tempo real para verificar duplicatas
  const checkNomeDuplicata = (nome: string) => {
    if (!servicos || nome.trim().length === 0) {
      setNomeError(null);
      return;
    }

    const nomeFormatado = nome.trim().toLowerCase();
    const servicoExistente = servicos.find(s => 
      s.nome.toLowerCase().trim() === nomeFormatado
    );

    if (servicoExistente) {
      setNomeError(`Já existe um serviço com o nome "${servicoExistente.nome}"`);
    } else {
      setNomeError(null);
    }
  };

  // Sugestões automáticas de nomes alternativos
  const gerarSugestoesNome = (nomeBase: string): string[] => {
    if (!servicos) return [];
    
    const sugestoes = [
      `${nomeBase} Tradicional`,
      `${nomeBase} Premium`,
      `${nomeBase} Express`,
      `${nomeBase} Completo`,
      `${nomeBase} Especial`
    ];

    return sugestoes.filter(sugestao => {
      const sugestaoFormatada = sugestao.toLowerCase().trim();
      return !servicos.some(s => s.nome.toLowerCase().trim() === sugestaoFormatada);
    }).slice(0, 3);
  };

  const openDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Serviços</h1>
              <p className="text-lg text-muted-foreground">
                Gerencie os serviços oferecidos pela barbearia
              </p>
            </div>
            
            {/* Filtros de Status */}
            <div className="flex gap-2">
              <Button
                variant={filtroStatus === 'ativo' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('ativo')}
                className="rounded-lg"
              >
                Ativos ({servicos?.filter((s: any) => s.isAssinatura).length || 0})
              </Button>
              <Button
                variant={filtroStatus === 'inativo' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('inativo')}
                className="rounded-lg"
              >
                Inativos ({servicos?.filter((s: any) => !s.isAssinatura).length || 0})
              </Button>
              <Button
                variant={filtroStatus === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltroStatus('todos')}
                className="rounded-lg"
              >
                Todos ({servicos?.length || 0})
              </Button>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={openDialog}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="space-y-4 pb-6">
                  <DialogTitle className="text-2xl font-bold text-center text-foreground">
                    Novo Serviço
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="nome" className="text-sm font-semibold text-foreground">
                      Nome do Serviço
                    </Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => {
                        const novoNome = e.target.value;
                        setFormData({ ...formData, nome: novoNome });
                        checkNomeDuplicata(novoNome);
                      }}
                      placeholder="Ex: Corte Masculino"
                      className={`h-12 rounded-xl border-2 border-border focus:border-primary transition-colors ${
                        nomeError ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                      required
                    />
                    
                    {nomeError && (
                      <div className="space-y-3">
                        <p className="text-red-500 text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {nomeError}
                        </p>
                        
                        {formData.nome.trim() && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-blue-700 text-sm font-medium mb-2">
                              Sugestões de nomes disponíveis:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {gerarSugestoesNome(formData.nome.trim()).map((sugestao, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, nome: sugestao });
                                    setNomeError(null);
                                  }}
                                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded-full transition-colors"
                                >
                                  {sugestao}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="tempo" className="text-sm font-semibold text-foreground">
                      Tempo do Serviço
                    </Label>
                    <Select 
                      value={formData.tempoMinutos.toString()} 
                      onValueChange={(value) => setFormData({ ...formData, tempoMinutos: parseInt(value) })}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-2 border-border focus:border-primary">
                        <SelectValue placeholder="Selecione o tempo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h 30min</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <DialogFooter className="flex gap-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1 h-12 rounded-xl border-2 hover:bg-muted font-semibold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || !!nomeError || !formData.nome.trim()}
                      className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                    >
                      {createMutation.isPending ? "Cadastrando..." : "Cadastrar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de Serviços */}
        <div className="space-y-6">
          {servicos && servicos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicos.map((servico) => (
                <Card 
                  key={servico.id} 
                  className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-0 shadow-lg rounded-2xl overflow-hidden"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                        <Scissors className="h-6 w-6 text-white" />
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="bg-primary/10 text-primary border-0 px-3 py-1 rounded-full font-semibold"
                      >
                        #{servico.id}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {servico.nome}
                      </h3>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{servico.tempoMinutos} minutos</span>
                      </div>
                    </div>
                    
                    {servico.percentualComissao && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Comissão</span>
                          <Badge className="bg-green-100 text-green-700 border-0 rounded-full">
                            {Number(servico.percentualComissao)}%
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-12 text-center space-y-4">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Scissors className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Nenhum serviço cadastrado</h3>
                  <p className="text-muted-foreground">
                    Comece cadastrando o primeiro serviço da sua barbearia
                  </p>
                </div>
                <Button 
                  onClick={openDialog}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Cadastrar Primeiro Serviço
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}