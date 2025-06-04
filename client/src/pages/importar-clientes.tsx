import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileText, Users, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export function ImportarClientes() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dadosManuais, setDadosManuais] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { toast } = useToast();

  const exemploJson = `[
  {
    "nome": "João Silva",
    "cpf": "123.456.789-00",
    "email": "joao@email.com",
    "telefone": "(31) 99999-9999",
    "proximoVencimento": "2025-06-01",
    "plano": "Barba Mensal"
  },
  {
    "nome": "Maria Santos",
    "cpf": "987.654.321-00",
    "email": "maria@email.com",
    "telefone": "(31) 88888-8888",
    "proximoVencimento": "2025-05-15",
    "plano": "Corte + Barba"
  }
]`;

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      setDadosManuais(''); // Limpar dados manuais se arquivo foi selecionado
    }
  };

  const handleImportacao = async () => {
    try {
      setCarregando(true);
      setResultado(null);

      let response;

      if (arquivo) {
        // Importar via arquivo
        const formData = new FormData();
        formData.append('planilha', arquivo);

        response = await fetch('/api/clientes/importar', {
          method: 'POST',
          body: formData
        });
      } else if (dadosManuais.trim()) {
        // Importar via dados manuais
        try {
          const clientes = JSON.parse(dadosManuais);
          response = await apiRequest('/api/clientes/importar', {
            method: 'POST',
            body: { clientes }
          });
        } catch (error) {
          toast({
            title: 'Erro no formato JSON',
            description: 'Verifique se os dados estão no formato correto',
            variant: 'destructive'
          });
          return;
        }
      } else {
        toast({
          title: 'Nenhum dado fornecido',
          description: 'Selecione um arquivo ou digite os dados manualmente',
          variant: 'destructive'
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setResultado(data.resultados);
        toast({
          title: 'Importação concluída',
          description: data.message
        });
        
        // Limpar formulário
        setArquivo(null);
        setDadosManuais('');
        const fileInput = document.getElementById('arquivo') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: error.message || 'Erro interno do servidor',
        variant: 'destructive'
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Importar Clientes</h1>
          <p className="text-muted-foreground">
            Importe clientes da planilha ou cadastre manualmente
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Importação via Arquivo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Importar via Planilha</span>
            </CardTitle>
            <CardDescription>
              Selecione o arquivo Assinantes.xltx ou arquivo Excel compatível
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="arquivo">Arquivo da Planilha</Label>
              <Input
                id="arquivo"
                type="file"
                accept=".xltx,.xlsx,.xls"
                onChange={handleArquivoChange}
                disabled={carregando}
              />
              {arquivo && (
                <p className="text-sm text-muted-foreground mt-2">
                  Arquivo selecionado: {arquivo.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cadastro Manual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Cadastro Manual</span>
            </CardTitle>
            <CardDescription>
              Digite os dados dos clientes no formato JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dados-manuais">Dados dos Clientes (JSON)</Label>
              <Textarea
                id="dados-manuais"
                placeholder="Cole os dados dos clientes aqui..."
                value={dadosManuais}
                onChange={(e) => setDadosManuais(e.target.value)}
                rows={8}
                disabled={carregando}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exemplo de formato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>Formato dos Dados</span>
          </CardTitle>
          <CardDescription>
            Exemplo do formato JSON para cadastro manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            {exemploJson}
          </pre>
        </CardContent>
      </Card>

      {/* Botão de Importação */}
      <div className="flex justify-center">
        <Button
          onClick={handleImportacao}
          disabled={carregando || (!arquivo && !dadosManuais.trim())}
          size="lg"
          className="w-full md:w-auto"
        >
          {carregando ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Importando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Importar Clientes
            </>
          )}
        </Button>
      </div>

      {/* Resultado da Importação */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Resultado da Importação</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{resultado.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{resultado.cadastrados}</div>
                <div className="text-sm text-muted-foreground">Cadastrados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{resultado.pulados}</div>
                <div className="text-sm text-muted-foreground">Pulados</div>
              </div>
            </div>

            {resultado.erros && resultado.erros.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erros Encontrados</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {resultado.erros.map((erro: any, index: number) => (
                      <li key={index}>
                        <strong>{erro.cliente}:</strong> {erro.erro}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              Clientes cadastrados com sucesso foram salvos na mesma tabela dos clientes do Asaas.
              Clientes com próximo vencimento já passado foram marcados como "INATIVO" e mostrarão 
              o botão "Gerar Cobrança" na lista de clientes.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}