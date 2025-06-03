import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function TestAsaas() {
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  
  const [healthResult, setHealthResult] = useState<any>(null);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    cliente: {
      name: "João da Silva",
      email: "joao@email.com",
      cpfCnpj: "12345678900",
      phone: "31988888888"
    },
    assinatura: {
      name: "Assinatura Gold",
      description: "Acesso premium mensal",
      value: 97.90,
      subscriptionCycle: "MONTHLY"
    }
  });

  const testHealth = async () => {
    setIsTestingHealth(true);
    setHealthResult(null);
    
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthResult({ success: response.ok, data });
    } catch (error) {
      setHealthResult({ success: false, error: error.message });
    } finally {
      setIsTestingHealth(false);
    }
  };

  const testAsaasConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);
    
    try {
      const response = await fetch('/api/test-asaas');
      const data = await response.json();
      setConnectionResult({ success: response.ok, data });
    } catch (error) {
      setConnectionResult({ success: false, error: error.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const createCustomerSubscription = async () => {
    setIsCreatingSubscription(true);
    setSubscriptionResult(null);
    
    try {
      const response = await fetch('/api/create-customer-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      setSubscriptionResult({ success: response.ok, data });
    } catch (error) {
      setSubscriptionResult({ success: false, error: error.message });
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const updateClienteField = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      cliente: {
        ...prev.cliente,
        [field]: value
      }
    }));
  };

  const updateAssinaturaField = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      assinatura: {
        ...prev.assinatura,
        [field]: value
      }
    }));
  };

  const ResultCard = ({ title, isLoading, result }: { title: string; isLoading: boolean; result: any }) => {
    if (!result && !isLoading) return null;
    
    return (
      <Alert className={result?.success ? "border-green-500" : "border-red-500"}>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : result?.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span className="font-medium">{title}</span>
        </div>
        <AlertDescription className="mt-2">
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(result?.data || result?.error || "Processando...", null, 2)}
          </pre>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Teste Integração Asaas v3</h1>
        <p className="text-muted-foreground mt-2">
          Teste completo do fluxo: cadastrar cliente + criar paymentLink
        </p>
      </div>

      {/* Testes de Conexão */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Health Check</CardTitle>
            <CardDescription>Verificar se a API está funcionando</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testHealth} disabled={isTestingHealth} className="w-full">
              {isTestingHealth ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Testar Health
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conexão Asaas</CardTitle>
            <CardDescription>Testar conexão com API do Asaas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testAsaasConnection} disabled={isTestingConnection} className="w-full">
              {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Formulário de Teste do Fluxo Completo */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo Completo: Cliente + PaymentLink</CardTitle>
          <CardDescription>
            Cadastrar cliente no Asaas (se não existir) e criar link de pagamento recorrente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dados do Cliente */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Dados do Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.cliente.name}
                  onChange={(e) => updateClienteField('name', e.target.value)}
                  placeholder="João da Silva"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.cliente.email}
                  onChange={(e) => updateClienteField('email', e.target.value)}
                  placeholder="joao@email.com"
                />
              </div>
              <div>
                <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                <Input
                  id="cpfCnpj"
                  value={formData.cliente.cpfCnpj}
                  onChange={(e) => updateClienteField('cpfCnpj', e.target.value)}
                  placeholder="12345678900"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.cliente.phone}
                  onChange={(e) => updateClienteField('phone', e.target.value)}
                  placeholder="31988888888"
                />
              </div>
            </div>
          </div>

          {/* Dados da Assinatura */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Dados da Assinatura</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planName">Nome do Plano</Label>
                <Input
                  id="planName"
                  value={formData.assinatura.name}
                  onChange={(e) => updateAssinaturaField('name', e.target.value)}
                  placeholder="Assinatura Gold"
                />
              </div>
              <div>
                <Label htmlFor="value">Valor (R$)</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={formData.assinatura.value}
                  onChange={(e) => updateAssinaturaField('value', parseFloat(e.target.value) || 0)}
                  placeholder="97.90"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.assinatura.description}
                  onChange={(e) => updateAssinaturaField('description', e.target.value)}
                  placeholder="Acesso premium mensal"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="cycle">Ciclo de Cobrança</Label>
                <Select 
                  value={formData.assinatura.subscriptionCycle} 
                  onValueChange={(value) => updateAssinaturaField('subscriptionCycle', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ciclo" />
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
            </div>
          </div>

          <Button 
            onClick={createCustomerSubscription} 
            disabled={isCreatingSubscription}
            className="w-full"
            size="lg"
          >
            {isCreatingSubscription ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar Cliente + PaymentLink
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      <div className="space-y-4">
        <ResultCard title="Health Check" isLoading={isTestingHealth} result={healthResult} />
        <ResultCard title="Conexão Asaas" isLoading={isTestingConnection} result={connectionResult} />
        <ResultCard title="Cliente + PaymentLink" isLoading={isCreatingSubscription} result={subscriptionResult} />
      </div>
    </div>
  );
}