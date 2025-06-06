import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, ArrowLeft, Check, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { z } from "zod";

const clienteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  telefone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  email: z.string().email("Email inválido")
});

// Schema para importação via Excel (email é opcional)
const clienteExcelSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  telefone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  email: z.string().email("Email inválido").optional().or(z.literal(""))
});

type ClienteFormData = z.infer<typeof clienteSchema>;
type ClienteExcelData = z.infer<typeof clienteExcelSchema>;

interface ImportResult {
  novos: number;
  atualizados: number;
  erros: { linha: number; motivo: string }[];
}

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
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

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

  // Processar arquivo Excel
  const processarArquivoExcel = async (file: File): Promise<ClienteExcelData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Verificar se há dados
          if (jsonData.length < 2) {
            reject(new Error("Arquivo deve conter pelo menos uma linha de dados além do cabeçalho"));
            return;
          }

          // Verificar cabeçalhos
          const headers = jsonData[0] as string[];
          const expectedHeaders = ["Nome Completo", "Telefone", "Email"];
          const hasCorrectHeaders = expectedHeaders.every(header => 
            headers.some(h => h?.toLowerCase().includes(header.toLowerCase()))
          );

          if (!hasCorrectHeaders) {
            reject(new Error("Arquivo deve conter as colunas: Nome Completo, Telefone, Email"));
            return;
          }

          // Processar dados
          const clientes: ClienteExcelData[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.length >= 2) { // Pelo menos nome e telefone
              clientes.push({
                nome: String(row[0] || "").trim(),
                telefone: String(row[1] || "").trim(),
                email: String(row[2] || "").trim()
              });
            }
          }

          resolve(clientes);
        } catch (error) {
          reject(new Error("Erro ao processar arquivo Excel"));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Importação em lote
  const importarClientesLote = useMutation({
    mutationFn: async (clientes: ClienteExcelData[]) => {
      const response = await fetch("/api/clientes/importar-lote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientes })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao importar clientes");
      }
      
      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      
      toast({
        title: "Importação concluída!",
        description: `${result.novos} novos clientes, ${result.atualizados} atualizados`,
        duration: 5000
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
        duration: 4000
      });
    }
  });

  // Configurar dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      
      setIsProcessingFile(true);
      setImportResult(null);
      
      try {
        const file = acceptedFiles[0];
        const clientesData = await processarArquivoExcel(file);
        
        // Validar dados
        const clientesValidos: ClienteExcelData[] = [];
        const erros: { linha: number; motivo: string }[] = [];
        
        clientesData.forEach((cliente, index) => {
          try {
            // Validação básica
            if (!cliente.nome || cliente.nome.length < 2) {
              erros.push({ linha: index + 2, motivo: "Nome deve ter pelo menos 2 caracteres" });
              return;
            }
            
            if (!cliente.telefone || cliente.telefone.length < 10) {
              erros.push({ linha: index + 2, motivo: "Telefone deve ter pelo menos 10 dígitos" });
              return;
            }
            
            // Email é opcional, mas se fornecido deve ser válido
            if (cliente.email && cliente.email !== "") {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(cliente.email)) {
                erros.push({ linha: index + 2, motivo: "Email inválido" });
                return;
              }
            }
            
            clientesValidos.push(cliente);
          } catch (error) {
            erros.push({ linha: index + 2, motivo: "Erro na validação dos dados" });
          }
        });
        
        if (clientesValidos.length === 0) {
          setImportResult({ novos: 0, atualizados: 0, erros });
        } else {
          importarClientesLote.mutate(clientesValidos);
        }
        
      } catch (error: any) {
        toast({
          title: "Erro ao processar arquivo",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setIsProcessingFile(false);
      }
    }
  });

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

        {/* Abas de Cadastro */}
        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Cadastro Individual
            </TabsTrigger>
            <TabsTrigger value="importacao" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Importação Excel
            </TabsTrigger>
          </TabsList>

          {/* Aba Cadastro Individual */}
          <TabsContent value="individual">
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
          </TabsContent>

          {/* Aba Importação Excel */}
          <TabsContent value="importacao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importação em Massa via Excel
                </CardTitle>
                <CardDescription>
                  Importe vários clientes de uma vez usando um arquivo Excel (.xlsx)
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Instruções */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Formato do Arquivo Excel:
                  </h4>
                  <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <li>• <strong>Coluna A:</strong> Nome Completo (obrigatório)</li>
                    <li>• <strong>Coluna B:</strong> Telefone (obrigatório)</li>
                    <li>• <strong>Coluna C:</strong> Email (opcional)</li>
                  </ul>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    A primeira linha deve conter os cabeçalhos das colunas.
                  </p>
                </div>

                {/* Área de Drop */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                      : "border-gray-300 dark:border-gray-700 hover:border-blue-400"
                    }
                    ${isProcessingFile ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <input {...getInputProps()} disabled={isProcessingFile} />
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    {isProcessingFile ? (
                      <div className="space-y-2">
                        <p className="text-lg font-medium">Processando arquivo...</p>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-lg font-medium">
                          {isDragActive 
                            ? "Solte o arquivo aqui..." 
                            : "Arraste e solte seu arquivo Excel aqui"
                          }
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          ou clique para selecionar um arquivo
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Apenas arquivos .xlsx e .xls são aceitos
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Relatório de Importação */}
                {importResult && (
                  <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-5 w-5" />
                        Relatório de Importação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <span className="text-sm font-medium">Novos Clientes:</span>
                          <Badge variant="default" className="bg-green-600">
                            {importResult.novos}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <span className="text-sm font-medium">Clientes Atualizados:</span>
                          <Badge variant="secondary">
                            {importResult.atualizados}
                          </Badge>
                        </div>
                      </div>

                      {importResult.erros.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Erros encontrados ({importResult.erros.length}):
                          </h5>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {importResult.erros.map((erro, index) => (
                              <div key={index} className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                                <span className="font-medium">Linha {erro.linha}:</span> {erro.motivo}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Status da Importação */}
                {importarClientesLote.isPending && (
                  <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                        <span className="text-blue-800 dark:text-blue-200">
                          Importando clientes para o sistema...
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/clientes")}
                    className="flex-1"
                  >
                    Voltar para Clientes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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