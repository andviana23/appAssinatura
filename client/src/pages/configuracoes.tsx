import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, User, Lock, Camera, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ConfigData {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
  confirmarSenha?: string;
  fotoPerfil?: string;
}

export default function Configuracoes() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ConfigData>({
    nome: user?.nome || "",
    email: user?.email || "",
    senhaAtual: "",
    novaSenha: "",
    confirmarSenha: "",
    fotoPerfil: user?.fotoPerfil || "",
  });

  const [activeTab, setActiveTab] = useState<"perfil" | "senha">("perfil");

  const updatePerfil = useMutation({
    mutationFn: (data: any) => 
      apiRequest("/api/user/perfil", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Perfil atualizado com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar perfil", 
        description: error.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const updateSenha = useMutation({
    mutationFn: (data: any) => 
      apiRequest("/api/user/senha", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Senha alterada com sucesso!" });
      setFormData(prev => ({
        ...prev,
        senhaAtual: "",
        novaSenha: "",
        confirmarSenha: "",
      }));
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao alterar senha", 
        description: error.message || "Verifique sua senha atual",
        variant: "destructive" 
      });
    },
  });

  const handlePerfilSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePerfil.mutate({
      nome: formData.nome,
      email: formData.email,
      fotoPerfil: formData.fotoPerfil,
    });
  };

  const handleSenhaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.novaSenha !== formData.confirmarSenha) {
      toast({ 
        title: "Senhas não conferem", 
        description: "A nova senha e confirmação devem ser iguais",
        variant: "destructive" 
      });
      return;
    }

    if (!formData.senhaAtual || !formData.novaSenha) {
      toast({ 
        title: "Preencha todos os campos", 
        variant: "destructive" 
      });
      return;
    }

    updateSenha.mutate({
      senhaAtual: formData.senhaAtual,
      novaSenha: formData.novaSenha,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Verificar se é uma imagem
      if (!file.type.startsWith('image/')) {
        toast({ 
          title: "Arquivo inválido", 
          description: "Selecione apenas arquivos de imagem",
          variant: "destructive" 
        });
        return;
      }

      // Verificar tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({ 
          title: "Arquivo muito grande", 
          description: "A imagem deve ter no máximo 2MB",
          variant: "destructive" 
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData(prev => ({ ...prev, fotoPerfil: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#365e78]">Configurações</h1>
          <p className="text-gray-600">Gerencie suas informações pessoais e segurança</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === "perfil" 
              ? "bg-white text-[#365e78] shadow-sm" 
              : "text-gray-600 hover:text-[#365e78]"
          }`}
        >
          <User className="h-4 w-4 inline-block mr-2" />
          Perfil
        </button>
        <button
          onClick={() => setActiveTab("senha")}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === "senha" 
              ? "bg-white text-[#365e78] shadow-sm" 
              : "text-gray-600 hover:text-[#365e78]"
          }`}
        >
          <Lock className="h-4 w-4 inline-block mr-2" />
          Senha
        </button>
      </div>

      {/* Content */}
      {activeTab === "perfil" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[#365e78]">Informações do Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePerfilSubmit} className="space-y-6">
              {/* Foto de Perfil */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={formData.fotoPerfil} />
                    <AvatarFallback className="bg-[#365e78] text-white text-lg">
                      {getInitials(formData.nome || "US")}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="foto-upload"
                    className="absolute -bottom-2 -right-2 bg-[#365e78] text-white p-2 rounded-full cursor-pointer hover:bg-[#2a4a5e] transition-colors"
                  >
                    <Camera className="h-3 w-3" />
                    <input
                      id="foto-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <h3 className="font-medium text-[#365e78]">Foto de Perfil</h3>
                  <p className="text-sm text-gray-600">
                    Clique no ícone da câmera para alterar sua foto
                  </p>
                  <p className="text-xs text-gray-500">
                    Formatos aceitos: JPG, PNG. Tamanho máximo: 2MB
                  </p>
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="bg-[#365e78] hover:bg-[#2a4a5e]"
                disabled={updatePerfil.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updatePerfil.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "senha" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[#365e78]">Alterar Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSenhaSubmit} className="space-y-6">
              {/* Senha Atual */}
              <div className="space-y-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <Input
                  id="senhaAtual"
                  type="password"
                  value={formData.senhaAtual}
                  onChange={(e) => setFormData(prev => ({ ...prev, senhaAtual: e.target.value }))}
                  placeholder="Digite sua senha atual"
                  required
                />
              </div>

              {/* Nova Senha */}
              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input
                  id="novaSenha"
                  type="password"
                  value={formData.novaSenha}
                  onChange={(e) => setFormData(prev => ({ ...prev, novaSenha: e.target.value }))}
                  placeholder="Digite sua nova senha"
                  required
                />
                <p className="text-xs text-gray-500">
                  A senha deve ter pelo menos 6 caracteres
                </p>
              </div>

              {/* Confirmar Nova Senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                  placeholder="Confirme sua nova senha"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="bg-[#365e78] hover:bg-[#2a4a5e]"
                disabled={updateSenha.isPending}
              >
                <Lock className="h-4 w-4 mr-2" />
                {updateSenha.isPending ? "Alterando..." : "Alterar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}