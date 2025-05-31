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
    queryKey: ["/api/barbeiros"],
    enabled: !isNovo && !isEdicao, // Só carregar lista se não estiver em formulário
  });

  // Carregar dados do profissional para edição
  const { data: profissionalData } = useQuery({
    queryKey: ["/api/barbeiros", profissionalId],
    enabled: isEdicao && !!profissionalId,
  });

  // Preencher formulário quando carregar dados para edição
  useEffect(() => {
    if (profissionalData && isEdicao) {
      setFormData({
        nome: profissionalData.nome || '',
        email: profissionalData.email || '',
        senha: '',
        telefone: profissionalData.telefone || '',
        endereco: profissionalData.endereco || '',
        comissao: profissionalData.comissao || 50,
        ativo: profissionalData.ativo ?? true,
        role: profissionalData.role || 'barbeiro'
      });
    }
  }, [profissionalData, isEdicao]);

  const criarProfissional = useMutation({
    mutationFn: (data: any) => {
      if (formData.role === 'barbeiro') {
        return apiRequest("/api/barbeiros", "POST", data);
      } else {
        return apiRequest("/api/users", "POST", { ...data, role: 'recepcionista' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      toast({ title: "Profissional cadastrado com sucesso!" });
      setLocation("/profissionais");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao cadastrar profissional", 
        description: error.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const atualizarProfissional = useMutation({
    mutationFn: (data: any) => {
      if (formData.role === 'barbeiro') {
        return apiRequest(`/api/barbeiros/${profissionalId}`, "PUT", data);
      } else {
        return apiRequest(`/api/users/${profissionalId}`, "PUT", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      toast({ title: "Profissional atualizado com sucesso!" });
      setLocation("/profissionais");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar profissional", 
        description: error.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const deleteProfissional = useMutation({
    mutationFn: (id: number) => fetch(`/api/barbeiros/${id}`, {
      method: "DELETE",
    }).then(res => {
      if (!res.ok) throw new Error("Erro ao excluir profissional");
      return res.json();
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/barbeiros"] });
      toast({ title: "Profissional excluído com sucesso" });
    },
    onError: (error) => {
      console.error("Erro ao excluir profissional:", error);
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
      // Se estamos editando e senha está vazia, não enviar senha
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
      <div className="p-6 max-w-4xl mx-auto">
        {/* Botão Voltar */}
        <button
          onClick={() => setLocation("/profissionais")}
          className="flex items-center gap-2 mb-4 text-[#365e78] hover:text-[#2a4a5e] transition-colors"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#8B4513] mb-2">
            {isEdicao ? "Editar" : "Cadastrar"} {tipoProfissional === 'recepcionista' ? 'Recepcionista' : 'Barbeiro'}
          </h1>
          <p className="text-gray-600">
            {isEdicao ? "Edite os dados do profissional" : "Preencha os dados para cadastrar um novo profissional"}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
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
                    Senha {isEdicao ? "(deixe em branco para manter atual)" : "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={formData.senha}
                      onChange={(e) => handleInputChange('senha', e.target.value)}
                      placeholder={isEdicao ? "Nova senha (opcional)" : "Digite a senha"}
                      required={!isEdicao}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange('telefone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                    placeholder="Endereço completo"
                  />
                </div>

                {formData.role === 'barbeiro' && (
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
                  <Label htmlFor="ativo">Profissional ativo</Label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/profissionais")}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#365e78] hover:bg-[#2a4a5e] text-white"
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
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Renderizar listagem de profissionais
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Botão Voltar */}
      <button
        onClick={() => setLocation("/")}
        className="flex items-center gap-2 mb-4 text-[#365e78] hover:text-[#2a4a5e] transition-colors"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Profissionais</h1>
        <p className="text-gray-600">
          Gerencie barbeiros e recepcionistas da barbearia
        </p>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
          className="bg-[#365e78] hover:bg-[#2a4a5e] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Barbeiro
        </Button>
        <Button
          onClick={() => setLocation("/profissionais/novo?tipo=recepcionista")}
          variant="outline"
          className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Recepcionista
        </Button>
      </div>

      {/* Lista de Profissionais */}
      <div className="grid gap-4">
        {Array.isArray(barbeiros) && barbeiros.length > 0 ? (
          barbeiros.map((profissional: Profissional) => (
            <Card key={profissional.id} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#8B4513] text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {profissional.nome}
                      </h3>
                      <p className="text-gray-600">{profissional.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Barbeiro
                        </Badge>
                        <Badge 
                          variant={profissional.ativo ? "default" : "secondary"}
                          className={profissional.ativo ? "bg-green-100 text-green-800" : ""}
                        >
                          {profissional.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/profissionais/editar/${profissional.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(profissional)}
                      disabled={deleteProfissional.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-12 text-center">
              <UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum profissional cadastrado
              </h3>
              <p className="text-gray-600 mb-4">
                Comece cadastrando barbeiros e recepcionistas para sua equipe.
              </p>
              <Button
                onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
                className="bg-[#365e78] hover:bg-[#2a4a5e] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Profissional
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}