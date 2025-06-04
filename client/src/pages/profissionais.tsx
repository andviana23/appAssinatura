import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, User, Users, UserCheck, Edit, Trash2, Eye, EyeOff, Phone, Mail, Shield, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Profissional {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  tipo: string;
}

export default function Profissionais() {
  const [location, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRedefinirSenhaOpen, setIsRedefinirSenhaOpen] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<Profissional | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [usarSenhaPadrao, setUsarSenhaPadrao] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    senha: '',
    tipo: 'barbeiro'
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ["/api/profissionais"],
  });

  const profissionais = response?.data || [];

  // Mutation para redefinir senha
  const redefinirSenha = useMutation({
    mutationFn: async ({ id, novaSenha, usarSenhaPadrao }: { id: number, novaSenha?: string, usarSenhaPadrao: boolean }) => {
      const response = await apiRequest(`/api/profissionais/${id}/redefinir-senha`, "PATCH", {
        novaSenha,
        usarSenhaPadrao
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      toast({
        title: "Sucesso",
        description: data.message || "Senha redefinida com sucesso",
      });
      setIsRedefinirSenhaOpen(false);
      setProfissionalSelecionado(null);
      setNovaSenha("");
      setUsarSenhaPadrao(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao redefinir senha",
        variant: "destructive",
      });
    }
  });

  // Mutation para cadastrar profissional
  const criarProfissional = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("/api/profissionais", "POST", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profissional cadastrado com sucesso!",
        description: `${data.data.nome} foi adicionado à equipe.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      setFormData({ nome: '', telefone: '', email: '', senha: '', tipo: 'barbeiro' });
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar profissional",
        description: error.message || "Verifique os dados e tente novamente",
        variant: "destructive"
      });
    },
  });

  // Mutation para deletar profissional
  const deletarProfissional = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/profissionais/${id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profissional removido",
        description: "O profissional foi removido da equipe.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover profissional",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Função para abrir modal de redefinir senha
  const abrirModalRedefinirSenha = (profissional: Profissional) => {
    setProfissionalSelecionado(profissional);
    setIsRedefinirSenhaOpen(true);
    setNovaSenha("");
    setUsarSenhaPadrao(true);
  };

  // Função para confirmar redefinição de senha
  const confirmarRedefinirSenha = () => {
    if (!profissionalSelecionado) return;

    if (!usarSenhaPadrao && (!novaSenha || novaSenha.length < 8)) {
      toast({
        title: "Erro",
        description: "Nova senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    redefinirSenha.mutate({
      id: profissionalSelecionado.id,
      novaSenha: usarSenhaPadrao ? undefined : novaSenha,
      usarSenhaPadrao
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!formData.nome.trim() || !formData.email.trim() || !formData.senha.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, email e senha",
        variant: "destructive"
      });
      return;
    }

    if (formData.senha.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    criarProfissional.mutate(formData);
  };

  const handleDelete = (profissional: any) => {
    if (window.confirm(`Tem certeza que deseja remover ${profissional.nome} da equipe?`)) {
      deletarProfissional.mutate(profissional.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando profissionais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header com botão voltar */}
      <div className="space-y-4 sm:space-y-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-sm sm:text-base">Voltar ao Dashboard</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Gerenciar Profissionais
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Administre a equipe de barbeiros e recepcionistas
            </p>
          </div>

          {/* Botão principal de cadastro */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="hidden sm:inline">Cadastrar Profissional</span>
                <span className="sm:hidden">Novo Profissional</span>
              </Button>
            </DialogTrigger>

            {/* Modal de Cadastro */}
            <DialogContent className="sm:max-w-md">
              <DialogHeader className="text-center pb-4">
                <DialogTitle className="text-2xl font-bold text-foreground">
                  Novo Profissional
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Preencha os dados para cadastrar um novo membro da equipe
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-sm font-medium text-foreground">
                    Nome completo *
                  </Label>
                  <Input
                    id="nome"
                    type="text"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    placeholder="Digite o nome completo"
                    className="w-full"
                    required
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-sm font-medium text-foreground">
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full"
                    required
                  />
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="senha" className="text-sm font-medium text-foreground">
                    Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={formData.senha}
                      onChange={(e) => handleInputChange('senha', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Tipo */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Função *
                  </Label>
                  <RadioGroup
                    value={formData.tipo}
                    onValueChange={(value) => handleInputChange('tipo', value)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="barbeiro" id="barbeiro" />
                      <Label htmlFor="barbeiro" className="text-sm">Barbeiro</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="recepcionista" id="recepcionista" />
                      <Label htmlFor="recepcionista" className="text-sm">Recepcionista</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Botões do modal */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={criarProfissional.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {criarProfissional.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Cadastrando...
                      </>
                    ) : (
                      'Cadastrar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de Profissionais */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-card-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Equipe ({profissionais.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profissionais.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum profissional cadastrado
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comece adicionando barbeiros e recepcionistas à sua equipe
              </p>
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Profissional
              </Button>
            </div>
          ) : (
            <div className="grid-responsive-2 lg:grid-cols-3">
              {profissionais.map((profissional: Profissional) => (
                <Card key={profissional.id} className="bg-background border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-card-foreground">{profissional.nome}</h3>
                          <Badge 
                            variant={profissional.tipo === 'barbeiro' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {profissional.tipo === 'barbeiro' ? (
                              <>
                                <Scissors className="h-3 w-3 mr-1" />
                                Barbeiro
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3 mr-1" />
                                Recepcionista
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant={profissional.ativo ? 'default' : 'destructive'} className="text-xs">
                        {profissional.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {profissional.email}
                      </div>
                      {profissional.telefone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {profissional.telefone}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => abrirModalRedefinirSenha(profissional)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Redefinir Senha
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(profissional)}
                        disabled={deletarProfissional.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Redefinir Senha */}
      <Dialog open={isRedefinirSenhaOpen} onOpenChange={setIsRedefinirSenhaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Redefinir Senha
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Defina uma nova senha para {profissionalSelecionado?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Opção Senha Padrão */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="senha-padrao"
                  name="tipo-senha"
                  checked={usarSenhaPadrao}
                  onChange={(e) => setUsarSenhaPadrao(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <Label htmlFor="senha-padrao" className="text-sm font-medium text-foreground">
                  Usar senha padrão do sistema
                </Label>
              </div>
              {usarSenhaPadrao && (
                <div className="ml-6 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    A senha padrão <strong>"12345678"</strong> será definida para este profissional.
                  </p>
                </div>
              )}
            </div>

            {/* Opção Nova Senha */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="nova-senha"
                  name="tipo-senha"
                  checked={!usarSenhaPadrao}
                  onChange={(e) => setUsarSenhaPadrao(!e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <Label htmlFor="nova-senha" className="text-sm font-medium text-foreground">
                  Definir nova senha personalizada
                </Label>
              </div>
              {!usarSenhaPadrao && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="nova-senha-input" className="text-sm font-medium text-foreground">
                    Nova senha (mínimo 8 caracteres)
                  </Label>
                  <Input
                    id="nova-senha-input"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full"
                    minLength={8}
                  />
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsRedefinirSenhaOpen(false)}
                disabled={redefinirSenha.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={confirmarRedefinirSenha}
                disabled={redefinirSenha.isPending}
              >
                {redefinirSenha.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                    Redefinindo...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Redefinir Senha
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}