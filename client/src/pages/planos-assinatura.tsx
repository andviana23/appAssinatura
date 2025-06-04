import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Users, Package, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const createSubscriptionSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  cpfCnpj: z.string().optional(),
  plano: z.object({
    nome: z.string().min(3, 'Nome do plano deve ter pelo menos 3 caracteres'),
    valor: z.number().min(1, 'Valor deve ser maior que 0'),
    descricao: z.string().optional()
  })
});

type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;

interface SubscriptionResult {
  success: boolean;
  cliente?: {
    id: string;
    nome: string;
  };
  assinatura?: {
    id: string;
    linkId: string;
  };
  linkUrl?: string;
  paymentLinkResponse?: {
    id: string;
    name: string;
    value: number;
    url: string;
    chargeType: string;
    subscriptionCycle: string;
    description: string;
  };
  message?: string;
}

export default function PlanosAssinatura() {
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionResult, setSubscriptionResult] = useState<SubscriptionResult | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateSubscriptionData>({
    resolver: zodResolver(createSubscriptionSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      cpfCnpj: '',
      plano: {
        nome: '',
        valor: 0,
        descricao: ''
      }
    }
  });

  const onSubmit = async (data: CreateSubscriptionData) => {
    setIsLoading(true);
    setSubscriptionResult(null);

    try {
      const response = await fetch('/api/planos/criar-assinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSubscriptionResult(result);
        toast({
          title: 'Sucesso!',
          description: 'Plano de assinatura criado com sucesso',
        });
        form.reset();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.message || 'Erro ao criar plano de assinatura',
        });
      }
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro interno do servidor',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
          <p className="text-muted-foreground">
            Crie planos de assinatura recorrente integrados com Asaas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <Badge variant="outline">Sistema Asaas</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulário de Criação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Criar Nova Assinatura
            </CardTitle>
            <CardDescription>
              Preencha os dados do cliente e do plano para gerar o link de pagamento recorrente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Cliente</h3>
                  
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="joao.silva@email.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(31) 98888-7777" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpfCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123.456.789-09" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dados do Plano */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Plano</h3>
                  
                  <FormField
                    control={form.control}
                    name="plano.nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Plano *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Plano Premium Mensal" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plano.valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Mensal (R$) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="149.90" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plano.descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descrição do plano que aparecerá no checkout"
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando Assinatura...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Criar Plano de Assinatura
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Resultado da Criação */}
        <div className="space-y-6">
          {subscriptionResult?.success && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Assinatura Criada com Sucesso!
                </CardTitle>
                <CardDescription className="text-green-700">
                  {subscriptionResult.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informações do Cliente */}
                {subscriptionResult.cliente && (
                  <div className="p-4 bg-white rounded-lg border">
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">CLIENTE CRIADO</h4>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <strong>ID:</strong> {subscriptionResult.cliente.id}
                      </p>
                      <p className="text-sm">
                        <strong>Nome:</strong> {subscriptionResult.cliente.nome}
                      </p>
                    </div>
                  </div>
                )}

                {/* Informações do Plano */}
                {subscriptionResult.paymentLinkResponse && (
                  <div className="p-4 bg-white rounded-lg border">
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">PLANO CONFIGURADO</h4>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <strong>Nome:</strong> {subscriptionResult.paymentLinkResponse.name}
                      </p>
                      <p className="text-sm">
                        <strong>Valor:</strong> {formatCurrency(subscriptionResult.paymentLinkResponse.value)}
                      </p>
                      <p className="text-sm">
                        <strong>Ciclo:</strong> {subscriptionResult.paymentLinkResponse.subscriptionCycle}
                      </p>
                      <p className="text-sm">
                        <strong>Tipo:</strong> {subscriptionResult.paymentLinkResponse.chargeType}
                      </p>
                      {subscriptionResult.paymentLinkResponse.description && (
                        <p className="text-sm">
                          <strong>Descrição:</strong> {subscriptionResult.paymentLinkResponse.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Link de Pagamento */}
                {subscriptionResult.paymentLinkResponse?.url && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-sm text-blue-800 mb-2">LINK DE PAGAMENTO INDIVIDUALIZADO</h4>
                    <div className="space-y-3">
                      <p className="text-sm text-blue-700">
                        Link gerado com sucesso! Este é o link personalizado para o cliente fazer o pagamento recorrente:
                      </p>
                      <div className="flex items-center gap-2 p-2 bg-white rounded border">
                        <code className="text-sm flex-1 text-blue-600">
                          {subscriptionResult.paymentLinkResponse.url}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(subscriptionResult.paymentLinkResponse!.url);
                            toast({
                              title: 'Copiado!',
                              description: 'Link copiado para a área de transferência',
                            });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => window.open(subscriptionResult.paymentLinkResponse!.url, '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir Link de Pagamento
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Informações do Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como Funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">1</div>
                <p>Cliente é criado no sistema Asaas com os dados fornecidos</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">2</div>
                <p>Link de pagamento recorrente personalizado é gerado automaticamente</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">3</div>
                <p>Cliente acessa o link e realiza o pagamento mensal automaticamente</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">4</div>
                <p>Sistema acompanha automaticamente os status de pagamento</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}