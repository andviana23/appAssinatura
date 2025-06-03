import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function TestAsaas() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: 'Assinatura Gold',
    description: 'Acesso premium mensal',
    value: 97.90,
    subscriptionCycle: 'MONTHLY'
  });
  const { toast } = useToast();

  const testHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setResult(data);
      toast({
        title: "Teste de Health",
        description: `Status: ${data.status}`,
      });
    } catch (error) {
      console.error('Erro no teste de health:', error);
      toast({
        title: "Erro",
        description: "Falha no teste de health",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testAsaasConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-asaas');
      const data = await response.json();
      setResult(data);
      toast({
        title: "Teste de Conexão Asaas",
        description: data.success ? "Conexão OK" : "Falha na conexão",
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Erro no teste de conexão:', error);
      toast({
        title: "Erro",
        description: "Falha no teste de conexão",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createPaymentLink = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok && data.success) {
        toast({
          title: "Link Criado!",
          description: "Link de pagamento criado com sucesso",
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao criar link",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao criar link:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar link de pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Teste da API Asaas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Testes de Conectividade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testHealth} 
              disabled={loading}
              className="w-full"
            >
              🏥 Testar Health da API
            </Button>
            
            <Button 
              onClick={testAsaasConnection} 
              disabled={loading}
              className="w-full"
            >
              🔗 Testar Conexão com Asaas
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Criar Link de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
              />
            </div>
            
            <div>
              <Label>Ciclo da Assinatura</Label>
              <Select 
                value={formData.subscriptionCycle}
                onValueChange={(value) => setFormData({...formData, subscriptionCycle: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="BIWEEKLY">Quinzenal</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="SEMIANNUALLY">Semestral</SelectItem>
                  <SelectItem value="YEARLY">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={createPaymentLink} 
              disabled={loading}
              className="w-full"
            >
              💳 Criar Link de Pagamento
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
            
            {result.paymentUrl && (
              <div className="mt-4">
                <Label>Link de Pagamento:</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={result.paymentUrl} readOnly />
                  <Button 
                    onClick={() => window.open(result.paymentUrl, '_blank')}
                    variant="outline"
                  >
                    Abrir
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}