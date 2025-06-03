import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, User, UserCheck, Edit, Trash2, Eye, EyeOff, Phone, Mail, Shield } from "lucide-react";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!formData.nome.trim() || !formData.email.trim() || !formData.senha.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome, email e senha",
        variant: "destructive"
      });
      return;
    }
    
    criarProfissional.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({ nome: '', telefone: '', email: '', senha: '', tipo: 'barbeiro' });
    setIsModalOpen(false);
  };

  const handleDelete = (profissional: any) => {
    if (window.confirm(`Tem certeza que deseja remover ${profissional.nome} da equipe?`)) {
      deletarProfissional.mutate(profissional.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando profissionais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header com botão voltar */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar ao Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Gerenciar Profissionais
              </h1>
              <p className="text-lg text-gray-600">
                Administre a equipe de barbeiros e recepcionistas
              </p>
            </div>

            {/* Botão principal de cadastro */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg px-8 py-3"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Cadastrar Profissional
                </Button>
              </DialogTrigger>

              {/* Modal de Cadastro */}
              <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center pb-4">
                  <DialogTitle className="text-2xl font-bold text-gray-900">
                    Novo Profissional
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Preencha os dados para cadastrar um novo membro da equipe
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Nome */}
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-sm font-medium text-gray-700">
                      Nome do profissional *
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
                    <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">
                      Telefone
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="telefone"
                        type="tel"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange('telefone', e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      E-mail *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="email@exemplo.com"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {/* Senha */}
                  <div className="space-y-2">
                    <Label htmlFor="senha" className="text-sm font-medium text-gray-700">
                      Senha *
                    </Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        value={formData.senha}
                        onChange={(e) => handleInputChange('senha', e.target.value)}
                        placeholder="Digite uma senha segura"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      A senha será salva de forma segura. O profissional poderá alterá-la posteriormente.
                    </p>
                  </div>

                  {/* Tipo de Profissional */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">
                      Tipo de profissional *
                    </Label>
                    <RadioGroup 
                      value={formData.tipo} 
                      onValueChange={(value) => handleInputChange('tipo', value)}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="barbeiro" id="barbeiro" />
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <Label htmlFor="barbeiro" className="font-medium cursor-pointer">
                              Barbeiro
                            </Label>
                            <p className="text-sm text-gray-500">Profissional que realiza serviços de corte e barbearia</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="recepcionista" id="recepcionista" />
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <UserCheck className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <Label htmlFor="recepcionista" className="font-medium cursor-pointer">
                              Recepcionista
                            </Label>
                            <p className="text-sm text-gray-500">Responsável pelo atendimento e agendamentos</p>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Cadastrar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Profissionais</p>
                  <p className="text-2xl font-bold text-gray-900">{profissionais.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Profissionais Ativos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {profissionais.filter((p: Profissional) => p.ativo).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Barbeiros</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {profissionais.filter((p: Profissional) => p.tipo === 'barbeiro').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Profissionais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Equipe Cadastrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profissionais.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum profissional cadastrado
                </h3>
                <p className="text-gray-600 mb-6">
                  Comece cadastrando barbeiros e recepcionistas para sua equipe
                </p>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Profissional
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {profissionais.map((profissional: Profissional) => (
                  <div key={profissional.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        profissional.tipo === 'barbeiro' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {profissional.tipo === 'barbeiro' ? (
                          <User className={`h-6 w-6 ${profissional.tipo === 'barbeiro' ? 'text-blue-600' : 'text-green-600'}`} />
                        ) : (
                          <UserCheck className="h-6 w-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {profissional.nome}
                        </h3>
                        <p className="text-gray-600">{profissional.email}</p>
                        {profissional.telefone && (
                          <p className="text-sm text-gray-500">{profissional.telefone}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant={profissional.tipo === 'barbeiro' ? 'default' : 'secondary'}>
                            {profissional.tipo === 'barbeiro' ? 'Barbeiro' : 'Recepcionista'}
                          </Badge>
                          <Badge variant={profissional.ativo ? 'default' : 'secondary'} 
                                 className={profissional.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                            {profissional.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(profissional)}
                        disabled={deletarProfissional.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Cadastro */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Cadastrar Novo Profissional
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Adicione um novo barbeiro ou recepcionista à sua equipe
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-sm font-medium text-gray-700">
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

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
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

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">
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

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-sm font-medium text-gray-700">
                Senha *
              </Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  value={formData.senha}
                  onChange={(e) => handleInputChange('senha', e.target.value)}
                  placeholder="Digite uma senha segura"
                  className="w-full pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {/* Tipo de Profissional */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Tipo de profissional *
              </Label>
              <RadioGroup 
                value={formData.tipo} 
                onValueChange={(value) => handleInputChange('tipo', value)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="barbeiro" id="barbeiro" />
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <Label htmlFor="barbeiro" className="font-medium cursor-pointer">
                        Barbeiro
                      </Label>
                      <p className="text-sm text-gray-500">Profissional que realiza serviços de corte e barbearia</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="recepcionista" id="recepcionista" />
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <UserCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <Label htmlFor="recepcionista" className="font-medium cursor-pointer">
                        Recepcionista
                      </Label>
                      <p className="text-sm text-gray-500">Profissional responsável pelo atendimento e agenda</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
                disabled={criarProfissional.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={criarProfissional.isPending}
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
  );
}