import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, ArrowLeft, Check } from "lucide-react";
import { useLocation } from "wouter";
import { z } from "zod";

const clienteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  telefone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  email: z.string().email("Email inválido")
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function CadastroCliente() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ClienteFormData>({
    nome: "",
    telefone: "",
    email: ""
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cadastrarClienteMutation = useMutation({
    mutationFn: async (data: ClienteFormData) => {
      const response = await fetch("/api/clientes/cadastro-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao cadastrar cliente");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      toast({
        title: "Cliente cadastrado com sucesso!",
        description: data.isUpdate 
          ? "Dados do cliente foram atualizados."
          : "Novo cliente adicionado ao sistema.",
        duration: 3000
      });
      
      // Limpar formulário
      setFormData({ nome: "", telefone: "", email: "" });
      setErrors({});
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
        duration: 4000
      });
    }
  });

  const handleInputChange = (field: keyof ClienteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const formatarTelefone = (telefone: string) => {
    // Remove tudo que não é número
    const numbers = telefone.replace(/\D/g, '');
    
    // Aplica máscara (xx) xxxxx-xxxx
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatarTelefone(value);
    handleInputChange("telefone", formatted);
  };

  const validarFormulario = (): boolean => {
    try {
      clienteSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      toast({
        title: "Dados inválidos",
        description: "Por favor, corrija os erros no formulário",
        variant: "destructive"
      });
      return;
    }

    cadastrarClienteMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/clientes")}
              className="h-9 w-9 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Cadastro de Cliente
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Adicione um novo cliente ao sistema
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
            <CardDescription>
              Preencha as informações obrigatórias do cliente. Se o cliente já existir (mesmo email ou telefone), 
              os dados serão atualizados automaticamente.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">
                  Nome Completo *
                </Label>
                <Input
                  id="nome"
                  type="text"
                  value={formData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Digite o nome completo do cliente"
                  className={errors.nome ? "border-red-500" : ""}
                  disabled={cadastrarClienteMutation.isPending}
                />
                {errors.nome && (
                  <p className="text-sm text-red-600">{errors.nome}</p>
                )}
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-sm font-medium">
                  Telefone *
                </Label>
                <Input
                  id="telefone"
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className={errors.telefone ? "border-red-500" : ""}
                  disabled={cadastrarClienteMutation.isPending}
                  maxLength={15}
                />
                {errors.telefone && (
                  <p className="text-sm text-red-600">{errors.telefone}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className={errors.email ? "border-red-500" : ""}
                  disabled={cadastrarClienteMutation.isPending}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <Separator />

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/clientes")}
                  disabled={cadastrarClienteMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                
                <Button
                  type="submit"
                  disabled={cadastrarClienteMutation.isPending}
                  className="flex-1"
                >
                  {cadastrarClienteMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Cadastrar Cliente
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Informações importantes */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Informações Importantes:
              </h4>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Se o cliente já existir (mesmo email ou telefone), os dados serão atualizados</li>
                <li>• Clientes manuais podem ser atualizados automaticamente por dados do Asaas</li>
                <li>• Dados do Asaas sempre têm prioridade sobre cadastros manuais</li>
                <li>• Não há risco de duplicação de clientes no sistema</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}