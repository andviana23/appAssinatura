import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, Plus, User, UserCheck, Edit, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Profissional {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  tipo: string;
}

export default function Profissionais() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(useSearch());
  const params = useParams();
  
  // Detectar se estamos em modo de cadastro ou edição
  const isNovo = location.includes('/novo');
  const isEdicao = location.includes('/editar');
  const profissionalId = params.id ? parseInt(params.id) : null;
  const tipoProfissional = searchParams.get('tipo') || 'barbeiro';
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    endereco: '',
    comissao: 50,
    ativo: true,
    role: tipoProfissional === 'recepcionista' ? 'recepcionista' : 'barbeiro'
  });
  const [showPassword, setShowPassword] = useState(false);

  const { data: barbeiros = [], isLoading } = useQuery({
    queryKey: ["/api/profissionais"],
  });

  // Carregar dados do profissional para edição
  const { data: profissionalEdicao } = useQuery({
    queryKey: ["/api/profissionais", profissionalId],
    enabled: isEdicao && !!profissionalId,
  });

  useEffect(() => {
    if (profissionalEdicao && isEdicao) {
      setFormData({
        nome: profissionalEdicao.nome || '',
        email: profissionalEdicao.email || '',
        senha: '',
        telefone: profissionalEdicao.telefone || '',
        endereco: profissionalEdicao.endereco || '',
        comissao: profissionalEdicao.comissao || 50,
        ativo: profissionalEdicao.ativo ?? true,
        role: profissionalEdicao.role || 'barbeiro'
      });
    }
  }, [profissionalEdicao, isEdicao]);

  const criarProfissional = useMutation({
    mutationFn: (dados: any) => apiRequest("/api/profissionais", {
      method: "POST",
      body: JSON.stringify(dados),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      toast({ title: "Profissional cadastrado com sucesso!" });
      setLocation("/profissionais");
    },
    onError: () => {
      toast({ title: "Erro ao cadastrar profissional", variant: "destructive" });
    },
  });

  const atualizarProfissional = useMutation({
    mutationFn: (dados: any) => apiRequest(`/api/profissionais/${profissionalId}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      toast({ title: "Profissional atualizado com sucesso!" });
      setLocation("/profissionais");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar profissional", variant: "destructive" });
    },
  });

  const deleteProfissional = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/profissionais/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profissionais"] });
      toast({ title: "Profissional excluído com sucesso!" });
    },
    onError: () => {
      toast({ 
        title: "Não foi possível excluir este profissional", 
        variant: "destructive" 
      });
    },
  });

  const handleDelete = (profissional: Profissional) => {
    if (!window.confirm(`Tem certeza que deseja excluir o profissional ${profissional.nome}?`)) {
      return;
    }
    deleteProfissional.mutate(profissional.id);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Email é obrigatório", variant: "destructive" });
      return;
    }
    if (!isEdicao && !formData.senha.trim()) {
      toast({ title: "Senha é obrigatória", variant: "destructive" });
      return;
    }

    const dadosEnvio = { ...formData };
    if (isEdicao && !formData.senha.trim()) {
      delete dadosEnvio.senha;
    }

    if (isEdicao) {
      atualizarProfissional.mutate(dadosEnvio);
    } else {
      criarProfissional.mutate(dadosEnvio);
    }
  };

  // Renderizar formulário se estivermos em modo de cadastro ou edição
  if (isNovo || isEdicao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Botão Voltar */}
          <button
            onClick={() => setLocation("/profissionais")}
            className="flex items-center gap-2 mb-6 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                  {isEdicao ? "Editar" : "Cadastrar"} {tipoProfissional === 'recepcionista' ? 'Recepcionista' : 'Barbeiro'}
                </h1>
                <p className="text-gray-600 text-lg">
                  {isEdicao ? "Edite os dados do profissional" : "Preencha os dados para cadastrar um novo profissional"}
                </p>
              </div>
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      placeholder="Digite o nome completo"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Digite o email"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="senha">
                      {isEdicao ? "Nova Senha (opcional)" : "Senha *"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        value={formData.senha}
                        onChange={(e) => handleInputChange('senha', e.target.value)}
                        placeholder={isEdicao ? "Deixe em branco para manter atual" : "Digite a senha"}
                        required={!isEdicao}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange('telefone', e.target.value)}
                      placeholder="Digite o telefone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => handleInputChange('endereco', e.target.value)}
                      placeholder="Digite o endereço"
                    />
                  </div>

                  {tipoProfissional === 'barbeiro' && (
                    <div>
                      <Label htmlFor="comissao">Comissão (%)</Label>
                      <Input
                        id="comissao"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.comissao}
                        onChange={(e) => handleInputChange('comissao', parseInt(e.target.value) || 0)}
                        placeholder="50"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="tipo">Tipo de Profissional</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(value) => handleInputChange('role', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="barbeiro">Barbeiro</SelectItem>
                        <SelectItem value="recepcionista">Recepcionista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) => handleInputChange('ativo', checked)}
                    />
                    <Label htmlFor="ativo">Profissional Ativo</Label>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/profissionais")}
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    disabled={criarProfissional.isPending || atualizarProfissional.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isEdicao ? "Salvar Alterações" : "Cadastrar Profissional"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar listagem de profissionais
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Botão Voltar */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 mb-6 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                Profissionais
              </h1>
              <p className="text-gray-600 text-lg">
                Gerencie barbeiros e recepcionistas da barbearia
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
            className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Barbeiro
          </Button>
          <Button
            onClick={() => setLocation("/profissionais/novo?tipo=recepcionista")}
            variant="outline"
            className="border-2 border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Recepcionista
          </Button>
        </div>

        {/* Lista de Profissionais */}
        <div className="grid gap-6">
          {Array.isArray(barbeiros) && barbeiros.length > 0 ? (
            barbeiros.map((profissional: Profissional) => (
              <Card key={profissional.id} className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#365e78] to-[#2a4a5e] text-white shadow-lg">
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {profissional.nome}
                        </h3>
                        <p className="text-gray-600 text-lg">{profissional.email}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge 
                            variant={profissional.ativo ? "default" : "secondary"}
                            className={profissional.ativo ? 
                              "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg" : 
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {profissional.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="border-2 border-[#365e78] text-[#365e78] bg-[#365e78]/5 shadow-sm"
                          >
                            {profissional.tipo === 'recepcionista' ? 'Recepcionista' : 'Barbeiro'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/profissionais/editar/${profissional.id}?tipo=${profissional.tipo}`)}
                        className="border-2 border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(profissional)}
                        className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="h-20 w-20 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-3xl flex items-center justify-center shadow-xl mb-6">
                    <User className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Nenhum profissional cadastrado
                  </h3>
                  <p className="text-gray-600 text-lg mb-6">
                    Comece cadastrando seu primeiro barbeiro ou recepcionista
                  </p>
                  <Button
                    onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
                    className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Primeiro Profissional
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}