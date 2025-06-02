import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Users,
  TrendingUp,
  ArrowLeft,
  CheckCircle,
  Settings,
  User,
  Lock,
  Moon,
  Sun,
  Scissors,
  Award
} from "lucide-react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import dayjs from "dayjs";

export default function BarbeiroDashboardFinal() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Estados para filtros
  const [filtroMes, setFiltroMes] = useState(dayjs().format("YYYY-MM"));
  const [tema, setTema] = useState(() => {
    return localStorage.getItem('barbeiro-theme') || 'light';
  });
  
  // Estados para modais
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
  const [senhaModalOpen, setSenhaModalOpen] = useState(false);
  
  // Estados para formulários
  const [perfilForm, setPerfilForm] = useState({
    nome: user?.username || '',
    email: user?.email || ''
  });
  const [senhaForm, setSenhaForm] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: ''
  });

  // Buscar dados de comissão do barbeiro baseado na página de distribuição
  const { data: comissaoData, isLoading: comissaoLoading } = useQuery({
    queryKey: ["/api/barbeiro/comissao-dados", filtroMes],
    queryFn: () => apiRequest(`/api/barbeiro/comissao-dados?mes=${filtroMes}`),
  });

  // Buscar dados da Lista da Vez
  const { data: listaVezData, isLoading: listaLoading } = useQuery({
    queryKey: ["/api/lista-vez/barbeiro"],
    queryFn: () => apiRequest("/api/lista-vez/barbeiro"),
  });

  // Mutação para atualizar perfil
  const updatePerfilMutation = useMutation({
    mutationFn: async (data: typeof perfilForm) => {
      const response = await fetch("/api/barbeiro/perfil", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      setPerfilModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar perfil",
        variant: "destructive",
      });
    },
  });

  // Mutação para alterar senha
  const updateSenhaMutation = useMutation({
    mutationFn: async (data: typeof senhaForm) => {
      const response = await fetch("/api/barbeiro/senha", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senhaAtual: data.senhaAtual,
          novaSenha: data.novaSenha
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
      });
      setSenhaModalOpen(false);
      setSenhaForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar senha",
        variant: "destructive",
      });
    },
  });

  // Função para trocar tema
  const toggleTema = () => {
    const novoTema = tema === 'light' ? 'dark' : 'light';
    setTema(novoTema);
    localStorage.setItem('barbeiro-theme', novoTema);
    document.documentElement.classList.toggle('dark', novoTema === 'dark');
    
    toast({
      title: "Tema alterado",
      description: `Tema ${novoTema === 'light' ? 'claro' : 'escuro'} ativado.`,
    });
  };

  // Aplicar tema ao carregar
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
  }, [tema]);

  const handlePerfilSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePerfilMutation.mutate(perfilForm);
  };

  const handleSenhaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }
    updateSenhaMutation.mutate(senhaForm);
  };

  // Calcular estatísticas
  const servicosFinalizados = comissaoData?.totalServicos || 0;
  const tempoTotal = comissaoData?.tempoTotalMinutos || 0;
  const comissaoTotal = comissaoData?.comissaoTotal || 0;
  const clientesNaFila = listaVezData?.clientes?.length || 0;

  const tempoFormatado = `${Math.floor(tempoTotal / 60)}h ${tempoTotal % 60}min`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Dashboard Barbeiro
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Bem-vindo, {user?.nome}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de tema */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTema}
              className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white dark:border-slate-400 dark:text-slate-300"
            >
              {tema === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            {/* Modal Editar Perfil */}
            <Dialog open={perfilModalOpen} onOpenChange={setPerfilModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white dark:border-slate-400 dark:text-slate-300"
                >
                  <User className="h-4 w-4 mr-2" />
                  Perfil
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-slate-100">Editar Perfil</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePerfilSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nome" className="text-slate-700 dark:text-slate-300">Nome</Label>
                    <Input
                      id="nome"
                      value={perfilForm.nome}
                      onChange={(e) => setPerfilForm(prev => ({ ...prev, nome: e.target.value }))}
                      className="border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={perfilForm.email}
                      onChange={(e) => setPerfilForm(prev => ({ ...prev, email: e.target.value }))}
                      className="border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setPerfilModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updatePerfilMutation.isPending}
                      className="bg-[#365e78] hover:bg-[#2d4a5f] text-white"
                    >
                      {updatePerfilMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Modal Trocar Senha */}
            <Dialog open={senhaModalOpen} onOpenChange={setSenhaModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white dark:border-slate-400 dark:text-slate-300"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Senha
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-slate-100">Alterar Senha</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSenhaSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="senhaAtual" className="text-slate-700 dark:text-slate-300">Senha Atual</Label>
                    <Input
                      id="senhaAtual"
                      type="password"
                      value={senhaForm.senhaAtual}
                      onChange={(e) => setSenhaForm(prev => ({ ...prev, senhaAtual: e.target.value }))}
                      className="border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="novaSenha" className="text-slate-700 dark:text-slate-300">Nova Senha</Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      value={senhaForm.novaSenha}
                      onChange={(e) => setSenhaForm(prev => ({ ...prev, novaSenha: e.target.value }))}
                      className="border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmarSenha" className="text-slate-700 dark:text-slate-300">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmarSenha"
                      type="password"
                      value={senhaForm.confirmarSenha}
                      onChange={(e) => setSenhaForm(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                      className="border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setSenhaModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateSenhaMutation.isPending}
                      className="bg-[#365e78] hover:bg-[#2d4a5f] text-white"
                    >
                      {updateSenhaMutation.isPending ? "Alterando..." : "Alterar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Calendar className="h-5 w-5 text-[#365e78]" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="mes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Mês
                  </Label>
                  <Select value={filtroMes} onValueChange={setFiltroMes}>
                    <SelectTrigger className="border-slate-300 dark:border-slate-600 dark:bg-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = dayjs().month(i).format("YYYY-MM");
                        const mesNome = dayjs().month(i).format("MMMM YYYY");
                        return (
                          <SelectItem key={mes} value={mes}>
                            {mesNome}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Serviços Finalizados */}
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Serviços Finalizados
              </CardTitle>
              <CheckCircle className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              {comissaoLoading ? (
                <Skeleton className="h-8 w-16 bg-white/20" />
              ) : (
                <div className="text-2xl font-bold">{servicosFinalizados}</div>
              )}
              <p className="text-xs opacity-90">
                Total de serviços concluídos
              </p>
            </CardContent>
          </Card>

          {/* Tempo Trabalhado */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Tempo Trabalhado
              </CardTitle>
              <Clock className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              {comissaoLoading ? (
                <Skeleton className="h-8 w-20 bg-white/20" />
              ) : (
                <div className="text-2xl font-bold">{tempoFormatado}</div>
              )}
              <p className="text-xs opacity-90">
                Tempo total em atendimentos
              </p>
            </CardContent>
          </Card>

          {/* Comissão do Mês */}
          <Card className="bg-gradient-to-br from-[#365e78] to-[#2d4a5f] text-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Comissão do Mês
              </CardTitle>
              <DollarSign className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              {comissaoLoading ? (
                <Skeleton className="h-8 w-24 bg-white/20" />
              ) : (
                <div className="text-2xl font-bold">{formatCurrency(comissaoTotal)}</div>
              )}
              <p className="text-xs opacity-90">
                Valor total da comissão
              </p>
            </CardContent>
          </Card>

          {/* Lista da Vez */}
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium opacity-90">
                Lista da Vez
              </CardTitle>
              <Users className="h-4 w-4 opacity-90" />
            </CardHeader>
            <CardContent>
              {listaLoading ? (
                <Skeleton className="h-8 w-12 bg-white/20" />
              ) : (
                <div className="text-2xl font-bold">{clientesNaFila}</div>
              )}
              <p className="text-xs opacity-90">
                Clientes na fila
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Scissors className="h-5 w-5 text-[#365e78]" />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setLocation("/lista-da-vez")}
                className="w-full bg-[#365e78] hover:bg-[#2d4a5f] text-white"
              >
                Ver Lista da Vez
              </Button>
              <Button
                onClick={() => setLocation("/agenda")}
                variant="outline"
                className="w-full border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
              >
                Ver Agenda
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Award className="h-5 w-5 text-[#365e78]" />
                Desempenho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Média por Serviço</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {servicosFinalizados > 0 ? formatCurrency(comissaoTotal / servicosFinalizados) : "R$ 0,00"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Tempo Médio por Serviço</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {servicosFinalizados > 0 ? `${Math.round(tempoTotal / servicosFinalizados)} min` : "0 min"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}